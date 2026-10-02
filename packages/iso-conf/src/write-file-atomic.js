import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
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

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
    }
  }
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
const isUnsupportedChange = (error) => {
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
