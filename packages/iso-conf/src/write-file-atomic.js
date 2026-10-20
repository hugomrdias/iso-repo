import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

/**
 * Error codes for transient conditions worth retrying on every platform: file
 * descriptor exhaustion and a file briefly held by another process.
 */
const RETRY_CODES = new Set(['EAGAIN', 'EBUSY', 'EMFILE', 'ENFILE'])

/**
 * Error codes Windows also returns while another process, such as an
 * antivirus scanner or the search indexer, briefly holds the file open.
 * Elsewhere they are real permission errors.
 */
const WIN32_RETRY_CODES = new Set(['EACCES', 'EPERM'])

/** How long to keep retrying a transient error, in milliseconds. */
const RETRY_TIMEOUT = 1000

/**
 * Longest temporary file basename in bytes. Most file systems limit a
 * basename to 255 bytes, and the temporary file suffix takes at most 25.
 */
const MAX_TEMP_BASENAME = 200

/** Age after which a temporary file from a dead process is removed. */
const STALE_TEMP_AGE = 60_000

/**
 * Targets already checked for stale temporary files by this process.
 *
 * @type {Set<string>}
 */
const sweptTargets = new Set()

/**
 * Lock files held by this process. A nested lock on the same path, such as a
 * write inside `update()`, runs without waiting for itself.
 *
 * @type {Set<string>}
 */
const heldLocks = new Set()

/**
 * Get the error code of a thrown value.
 *
 * @param {unknown} error
 */
const errorCode = (error) =>
  /** @type {NodeJS.ErrnoException} */ (error)?.code ?? ''

/**
 * Run `fn`, retrying for up to a second while it fails with a transient error.
 *
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
const retry = (fn) => {
  const deadline = Date.now() + RETRY_TIMEOUT

  for (let delay = 10; ; delay = Math.min(delay * 2, 100)) {
    try {
      return fn()
    } catch (error) {
      const code = errorCode(error)

      if (
        !(
          RETRY_CODES.has(code) ||
          (process.platform === 'win32' && WIN32_RETRY_CODES.has(code))
        ) ||
        Date.now() + delay > deadline
      ) {
        throw error
      }

      sleepSync(delay)
    }
  }
}

/**
 * Block the thread for `ms` milliseconds.
 *
 * @param {number} ms
 */
const sleepSync = (ms) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Run a best-effort operation, ignoring any error.
 *
 * @param {() => void} fn
 */
const attempt = (fn) => {
  try {
    fn()
  } catch {
    // Best effort.
  }
}

/**
 * Whether a permission or owner change failed because the file system does
 * not support it, such as FAT, SMB shares or some container mounts.
 *
 * @param {unknown} error
 */
export const isUnsupportedChange = (error) => {
  const code = errorCode(error)
  const isRoot = process.geteuid?.() === 0
  return (
    code === 'ENOSYS' || (!isRoot && (code === 'EINVAL' || code === 'EPERM'))
  )
}

/**
 * Write all of `buffer` to `fd` from the start of the file.
 *
 * Writes are positional, so a retry after a partial write rewrites the same
 * bytes instead of appending.
 *
 * @param {number} fd
 * @param {Buffer} buffer
 */
const writeAll = (fd, buffer) => {
  let offset = 0

  while (offset < buffer.length) {
    offset += fs.writeSync(fd, buffer, offset, buffer.length - offset, offset)
  }
}

/**
 * Basename prefix shared by all temporary files for `target`, truncated so
 * the full temporary file name fits within the file system limit.
 *
 * @param {string} target
 */
const tempPrefix = (target) => {
  const chars = [...path.basename(target)]

  while (Buffer.byteLength(chars.join('')) > MAX_TEMP_BASENAME) {
    chars.pop()
  }

  return `${chars.join('')}.`
}

/**
 * Whether a process with `pid` is running.
 *
 * @param {number} pid
 */
const isRunning = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM means the process exists but belongs to another user.
    return errorCode(error) === 'EPERM'
  }
}

/**
 * Remove temporary files for `target` left behind by processes that were
 * killed mid-write. Runs once per target per process.
 *
 * A file is only removed when its process is gone and it is older than a
 * minute, so concurrent writers keep their in-flight files.
 *
 * @param {string} target
 */
const sweepStaleTempFiles = (target) => {
  if (sweptTargets.has(target)) {
    return
  }

  sweptTargets.add(target)

  const directory = path.dirname(target)
  const prefix = tempPrefix(target)
  /** @type {string[]} */
  let names = []
  attempt(() => {
    names = fs.readdirSync(directory)
  })

  for (const name of names) {
    if (!name.startsWith(prefix)) {
      continue
    }

    const match = /^(\d+)\.[0-9a-f]{8}\.tmp$/.exec(name.slice(prefix.length))

    if (!match) {
      continue
    }

    const pid = Number(match[1])

    if (pid === process.pid || isRunning(pid)) {
      continue
    }

    const tempPath = path.join(directory, name)
    attempt(() => {
      if (Date.now() - fs.statSync(tempPath).mtimeMs > STALE_TEMP_AGE) {
        fs.rmSync(tempPath, { force: true })
      }
    })
  }
}

/**
 * Write a file atomically.
 *
 * Writes `data` to a temporary file next to the target, flushes it to disk
 * and renames it over the target, so readers see either the old or the new
 * contents. Symlinks are followed, and an existing file keeps its owner when
 * running as root. Transient errors are retried for up to a second.
 *
 * Installs no process-wide exit or signal handlers. A failed write removes
 * its temporary file, and temporary files left behind by killed processes
 * are removed on a later write.
 *
 * @param {string} filePath - File to write.
 * @param {string} data - File contents.
 * @param {number} [mode] - File mode. Defaults to the existing file's mode.
 */
export const writeFileAtomicSync = (filePath, data, mode) => {
  let target = filePath
  /** @type {fs.Stats | undefined} */
  let stats

  try {
    target = fs.realpathSync(filePath)
    stats = fs.statSync(target)
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      throw error
    }
  }

  const fileMode = mode ?? (stats ? stats.mode & 0o7777 : 0o666)
  const tempPath = path.join(
    path.dirname(target),
    `${tempPrefix(target)}${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  )
  /** @type {number | undefined} */
  let fd

  try {
    fd = retry(() => fs.openSync(tempPath, 'wx', fileMode))
    const handle = fd
    const buffer = Buffer.from(data)
    retry(() => writeAll(handle, buffer))

    // `open` applies the umask, so set the exact mode.
    try {
      fs.fchmodSync(handle, fileMode)
    } catch (error) {
      if (!isUnsupportedChange(error)) {
        throw error
      }
    }

    if (
      stats &&
      process.geteuid &&
      process.getegid &&
      (stats.uid !== process.geteuid() || stats.gid !== process.getegid())
    ) {
      // Only root can change the owner.
      attempt(() => fs.fchownSync(handle, stats.uid, stats.gid))
    }

    retry(() => fs.fsyncSync(handle))
    fd = undefined
    fs.closeSync(handle)
    retry(() => fs.renameSync(tempPath, target))
  } catch (error) {
    const handle = fd

    if (handle !== undefined) {
      attempt(() => fs.closeSync(handle))
    }

    attempt(() => fs.rmSync(tempPath, { force: true }))
    throw error
  }

  sweepStaleTempFiles(target)
}

/**
 * Remove a lock file when it is stale: its process is gone, or it is older
 * than `stale` milliseconds.
 *
 * The process check only applies to locks taken on this host, as process ids
 * from other hosts or containers sharing the folder mean nothing here.
 *
 * @param {string} lockPath
 * @param {number} stale
 * @returns {boolean} Whether the lock is gone and taking it can be retried now.
 */
const breakStaleLock = (lockPath, stale) => {
  /** @type {fs.Stats} */
  let stats
  /** @type {string} */
  let content

  try {
    stats = fs.statSync(lockPath)
    content = fs.readFileSync(lockPath, 'utf8')
  } catch (error) {
    return errorCode(error) === 'ENOENT'
  }

  const [pid, host] = content.split(' ')
  const dead =
    host === os.hostname() && Number(pid) > 0 && !isRunning(Number(pid))

  if (!dead && Date.now() - stats.mtimeMs <= stale) {
    return false
  }

  // Move the lock aside before removing it, so that of several processes
  // breaking it at once only one succeeds.
  const stalePath = `${lockPath}.${process.pid}.${randomBytes(4).toString('hex')}.stale`

  try {
    fs.renameSync(lockPath, stalePath)
  } catch (error) {
    return errorCode(error) === 'ENOENT'
  }

  attempt(() => {
    const moved = fs.statSync(stalePath)

    // Another process broke the stale lock and took a new one in between, so
    // put that one back.
    if (moved.ino !== stats.ino || moved.mtimeMs !== stats.mtimeMs) {
      fs.linkSync(stalePath, lockPath)
    }
  })
  attempt(() => fs.rmSync(stalePath, { force: true }))
  return true
}

/**
 * Take an exclusive lock file.
 *
 * Creates `lockPath` with the process id, host name and a random token. While
 * another process holds it, retries every millisecond or two for up to
 * `timeout` milliseconds, and breaks it when it is stale. File system errors other than
 * the lock existing are thrown.
 *
 * @param {string} lockPath - Lock file path.
 * @param {{ timeout: number, stale: number }} options
 * @returns {(() => void) | undefined} Releases the lock, or `undefined` when
 *   the lock could not be taken before the timeout.
 */
export const lockSync = (lockPath, { timeout, stale }) => {
  if (heldLocks.has(lockPath)) {
    return () => {
      // The outer lock releases it.
    }
  }

  const token = `${process.pid} ${os.hostname()} ${randomBytes(8).toString('hex')}`
  const deadline = Date.now() + timeout

  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx', 0o600)

      try {
        fs.writeSync(fd, token)
      } catch (error) {
        attempt(() => fs.closeSync(fd))
        attempt(() => fs.rmSync(lockPath, { force: true }))
        throw error
      }

      fs.closeSync(fd)
      heldLocks.add(lockPath)

      return () => {
        heldLocks.delete(lockPath)

        // Only remove the lock while it is still ours, as it may have been
        // broken as stale and taken by another process.
        attempt(() => {
          if (fs.readFileSync(lockPath, 'utf8') === token) {
            fs.rmSync(lockPath, { force: true })
          }
        })
      }
    } catch (error) {
      const code = errorCode(error)

      // Windows reports a lock file that is being deleted as EPERM.
      if (
        code !== 'EEXIST' &&
        !(process.platform === 'win32' && code === 'EPERM')
      ) {
        throw error
      }
    }

    if (breakStaleLock(lockPath, stale)) {
      continue
    }

    const remaining = deadline - Date.now()

    if (remaining <= 0) {
      return undefined
    }

    // Poll often. A holder that writes again takes the lock back right after
    // releasing it, so a waiter that sleeps longer rarely gets a turn.
    sleepSync(Math.min(remaining, 1 + Math.random()))
  }
}
