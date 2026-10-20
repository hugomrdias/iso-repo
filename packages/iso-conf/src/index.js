import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { parse, stringify } from 'iso-base/json'
import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from './dot-path.js'
import {
  isUnsupportedChange,
  lockSync,
  writeFileAtomicSync,
} from './write-file-atomic.js'

/**
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 * @import {
 *   ConfErrorCode,
 *   Deserialize,
 *   OnDidAnyChangeCallback,
 *   OnDidChangeCallback,
 *   Options,
 *   SchemaArrayElement,
 *   SchemaEntry,
 *   SchemaKeyPath,
 *   SchemaValue,
 *   SchemaValues,
 *   Serialize,
 *   Unsubscribe,
 * } from './types.js'
 */

/**
 * Creates a null-prototype object for storing config data.
 *
 * @template T
 */
const createPlainObject = () => /** @type {T} */ (Object.create(null))

// any combination of spaces and punctuation characters
// thanks to http://stackoverflow.com/a/25575009
var wordSeparators =
  /[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]+/
var capital_plus_lower = /[A-ZÀ-Ý\u00C0-\u00D6\u00D9-\u00DD][a-zà-ÿ]/g
var capitals = /[A-ZÀ-Ý\u00C0-\u00D6\u00D9-\u00DD]+/g

/**
 * Convert a string to kebab case.
 *
 * @param {string} str
 * @returns {string}
 */
const kebabCase = (str) => {
  // replace word starts with space + lower case equivalent for later parsing
  // 1) treat cap + lower as start of new word
  str = str.replace(capital_plus_lower, (match) => {
    // match is one caps followed by one non-cap
    return ` ${match[0].toLowerCase() || match[0]}${match[1]}`
  })
  // 2) treat all remaining capitals as words
  str = str.replace(capitals, (match) => {
    // match is a series of caps
    return ` ${match.toLowerCase()}`
  })
  return str
    .trim()
    .split(wordSeparators)
    .join('-')
    .replace(/^-/, '')
    .replace(/-\s*$/, '')
}

/**
 * Throw when `name` can't be used as a single folder name.
 *
 * @param {string} name
 */
const assertSafeFilename = (name) => {
  const trimmed = name.trim()

  if (
    trimmed === '' ||
    trimmed === '.' ||
    trimmed === '..' ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('\0')
  ) {
    throw new Error(`Unsafe filename: ${JSON.stringify(name)}`)
  }
}

/**
 * Platform config folder for an app, matching `env-paths`.
 *
 * - macOS: `~/Library/Preferences/<name>`
 * - Windows: `%APPDATA%\\<name>\\Config`
 * - Linux and others: `$XDG_CONFIG_HOME/<name>`, or `~/.config/<name>`
 *
 * @param {string} name - App name.
 * @param {string} suffix - Appended to `name` with a dash, unless empty.
 */
const configDirectory = (name, suffix) => {
  assertSafeFilename(name)

  if (suffix) {
    name += `-${suffix}`
  }

  assertSafeFilename(name)

  const homedir = os.homedir()
  const { env } = process

  if (process.platform === 'darwin') {
    return path.join(homedir, 'Library', 'Preferences', name)
  }

  if (process.platform === 'win32') {
    const appData = env.APPDATA || path.join(homedir, 'AppData', 'Roaming')
    return path.join(appData, name, 'Config')
  }

  return path.join(env.XDG_CONFIG_HOME || path.join(homedir, '.config'), name)
}

/**
 * Dot path of a schema issue, such as `a.b.0`, or `null` when the issue has
 * no path or a key that is not a string or number.
 *
 * @param {StandardSchemaV1.Issue} issue
 */
const getDotPath = (issue) => {
  if (!issue.path?.length) {
    return null
  }

  const keys = []

  for (const item of issue.path) {
    const key = typeof item === 'object' ? item.key : item

    if (typeof key !== 'string' && typeof key !== 'number') {
      return null
    }

    keys.push(key)
  }

  return keys.join('.')
}

/**
 * Describes a `set()` key for error messages.
 *
 * `typeof null` and `typeof []` are both `object`, which would accept them
 * as object keys.
 *
 * @param {unknown} key - Key passed to `set()`.
 * @returns {string}
 */
const setKeyType = (key) => {
  if (key === null) {
    return 'null'
  }

  if (Array.isArray(key)) {
    return 'array'
  }

  return typeof key
}

/**
 * Ensures a value can be serialized to JSON.
 *
 * @param {string} key - Config key being set.
 * @param {unknown} value - Value being set.
 */
const checkValueType = (key, value) => {
  const nonJsonTypes = new Set(['undefined', 'symbol', 'function'])
  const type = typeof value

  if (nonJsonTypes.has(type)) {
    throw new TypeError(
      `Setting a value of type \`${type}\` for key \`${key}\` is not allowed as it's not supported by JSON`
    )
  }
}

/**
 * Error thrown when a config file can't be loaded or a value can't be stored.
 *
 * File system errors such as `EACCES` or `EISDIR` are not wrapped. They are
 * thrown as Node system errors with `code`, `syscall` and `path` set.
 */
export class ConfError extends Error {
  /**
   * - `ERR_CONF_PARSE`: the config file could not be deserialized.
   * - `ERR_CONF_SCHEMA`: the config file failed schema validation.
   * - `ERR_CONF_INVALID_VALUE`: a value being written failed schema validation.
   * - `ERR_CONF_LOCKED`: the `lock` option timed out waiting for another
   *   process to release the lock.
   *
   * @type {ConfErrorCode}
   */
  code

  /**
   * Absolute path to the config file.
   *
   * @type {string}
   */
  path

  /**
   * Schema issues, for `ERR_CONF_SCHEMA` and `ERR_CONF_INVALID_VALUE`.
   *
   * @type {readonly StandardSchemaV1.Issue[] | undefined}
   */
  issues

  /**
   * @param {ConfErrorCode} code
   * @param {string} message
   * @param {{ path: string, issues?: readonly StandardSchemaV1.Issue[], cause?: unknown }} details
   */
  constructor(code, message, { path, issues, cause }) {
    super(message, { cause })
    this.name = 'ConfError'
    this.code = code
    this.path = path
    this.issues = issues
  }
}

/**
 * Validates a value against a Standard Schema.
 *
 * @param {StandardSchemaV1} schema - Schema to validate against.
 * @param {unknown} value - Value to validate.
 * @param {ConfErrorCode} code - Error code for a validation failure.
 * @param {string} filePath - Config file path for a validation failure.
 */
const validateSchema = (schema, value, code, filePath) => {
  const result = schema['~standard'].validate(value)

  if (result instanceof Promise) {
    throw new TypeError(
      'Async schemas are not supported. The schema `validate` function must return synchronously.'
    )
  }

  if (result.issues) {
    const message = result.issues
      .map((issue) => {
        const dotPath = getDotPath(issue)
        return dotPath ? `\`${dotPath}\` ${issue.message}` : issue.message
      })
      .join('; ')
    throw new ConfError(code, `Config schema violation: ${message}`, {
      path: filePath,
      issues: result.issues,
    })
  }

  return result.value
}

/**
 * Simple config handling for your app or module.
 *
 * @template {StandardSchemaV1} Schema
 */
export class Conf {
  /** Absolute path to the config file. */
  /** @type {string} */
  path

  /**
   * Event target used for change notifications.
   *
   * Errors thrown by `onDidChange` / `onDidAnyChange` callbacks, or while
   * reading the config file for a change, are dispatched as an `error`
   * `CustomEvent` whose `detail` is the error, instead of escaping as uncaught
   * exceptions. With `watch` enabled, a file watcher failure also stops
   * watching and dispatches an `error` event.
   */
  /** @type {EventTarget} */
  events

  /** @type {StandardSchemaV1 | undefined} */
  #schema

  /** @type {Readonly<Options<Schema>>} */
  #options

  /**
   * Serialized `defaults` option, deserialized on demand so every store gets
   * its own copy.
   *
   * @type {string | undefined}
   */
  #defaultsData

  /** @type {fs.FSWatcher | undefined} */
  #watcher

  /** @type {boolean | undefined} */
  #watchFile

  /** @type {ReturnType<typeof debounce> | undefined} */
  #debouncedChangeHandler

  /**
   * Store snapshots shared by all listeners of a single `change` event, or
   * `null` when reading the config file failed.
   *
   * @type {WeakMap<Event, { data: string | undefined, store: SchemaValues<Schema> } | null>}
   */
  #changeSnapshots = new WeakMap()

  /**
   * Creates a new config store.
   *
   * @param {Options<Schema>} [partialOptions] - Config options.
   */
  constructor(partialOptions = /** @type {Options<Schema>} */ ({})) {
    const options = this.#prepareOptions(partialOptions)
    this.#options = options
    this.#schema = options.schema
    if (options.defaults !== undefined) {
      this.#defaultsData = this.#serialize(options.defaults)
    }
    this.events = new EventTarget()
    this.path = this.#resolvePath(options)

    if (options.watch) {
      this.#watch()
    }
  }

  /**
   * Get a config item.
   *
   * @template {SchemaKeyPath<Schema>} Key
   * @overload
   * @param {Key} key - Item key. Supports dot notation when enabled.
   * @returns {SchemaValue<Schema, Key>}
   */
  /**
   * Get a config item, falling back to a default value when missing.
   *
   * @template {SchemaKeyPath<Schema>} Key
   * @template DefaultValue
   * @overload
   * @param {Key} key - Item key. Supports dot notation when enabled.
   * @param {DefaultValue} defaultValue - Value returned when the item does not exist.
   * @returns {Exclude<SchemaValue<Schema, Key>, undefined> | DefaultValue}
   */
  /**
   * @param {string} key - Item key. Supports dot notation when enabled.
   * @param {unknown} [defaultValue] - Value returned when the item does not exist.
   */
  get(key, defaultValue) {
    return this.#getIn(this.store, key, defaultValue)
  }

  /**
   * Set one or more config items.
   *
   * @template {SchemaKeyPath<Schema>} Key
   * @overload
   * @param {Key} key - Item key. Supports dot notation when enabled.
   * @param {SchemaValue<Schema, Key>} value - Value to set.
   * @returns {void}
   */
  /**
   * Set multiple config items.
   *
   * @overload
   * @param {Partial<SchemaValues<Schema>> & Record<string, unknown>} key - Object of items to set.
   * @returns {void}
   */
  /**
   * @param {Record<string, unknown> | string} key - Item key or object of items to set.
   * @param {unknown} [value] - Value to set when `key` is a string.
   */
  set(key, value) {
    const keyType = setKeyType(key)

    if (keyType !== 'string' && keyType !== 'object') {
      throw new TypeError(
        `Expected \`key\` to be of type \`string\` or \`object\`, got ${keyType}`
      )
    }

    if (typeof key !== 'object' && value === undefined) {
      throw new TypeError('Use `delete()` to clear values')
    }

    this.#mutate((store) => {
      if (typeof key === 'object') {
        for (const [itemKey, itemValue] of Object.entries(key)) {
          this.#setIn(store, itemKey, itemValue)
        }
      } else {
        this.#setIn(store, key, value)
      }

      return store
    })
  }

  /**
   * Check whether a config item exists.
   *
   * @param {SchemaKeyPath<Schema>} key - Item key. Supports dot notation when enabled.
   */
  has(key) {
    const keyPath = String(key)

    if (this.#options.accessPropertiesByDotNotation) {
      return hasProperty(this.store, keyPath)
    }

    return keyPath in this.store
  }

  /**
   * Append an item to an array config value.
   *
   * Creates the array when the key does not exist.
   *
   * @template {SchemaKeyPath<Schema>} Key
   * @param {Key} key - Array key. Supports dot notation when enabled.
   * @param {SchemaArrayElement<Schema, Key>} value - Item to append.
   */
  appendToArray(key, value) {
    const keyPath = String(key)
    checkValueType(keyPath, value)

    this.#mutate((store) => {
      const array = this.#getIn(store, keyPath, [])

      if (!Array.isArray(array)) {
        throw new TypeError(
          `The key \`${keyPath}\` is already set to a non-array value`
        )
      }

      this.#setIn(store, keyPath, [...array, value])
      return store
    })
  }

  /**
   * Reset items to their default values.
   *
   * Values come from the `defaults` option first, then from the schema.
   * Keys without a default are left unchanged.
   *
   * @param {...SchemaKeyPath<Schema>} keys - Keys to reset. Supports dot notation when enabled.
   */
  reset(...keys) {
    this.#mutate((store) => {
      let changed = false

      for (const key of keys) {
        const keyPath = String(key)
        const value = this.#defaultFor(store, keyPath)

        if (value !== undefined) {
          this.#setIn(store, keyPath, value)
          changed = true
        }
      }

      return changed ? store : undefined
    })
  }

  /**
   * Delete a config item.
   *
   * @param {SchemaKeyPath<Schema>} key - Item key. Supports dot notation when enabled.
   */
  delete(key) {
    const keyPath = String(key)

    this.#mutate((store) => {
      if (this.#options.accessPropertiesByDotNotation) {
        deleteProperty(store, keyPath)
      } else {
        delete store[keyPath]
      }

      return store
    })
  }

  /**
   * Read, change and write the whole config in one step.
   *
   * `fn` gets a fresh copy of the stored config and returns the new config,
   * which is validated and written. Nothing is written when it is unchanged.
   * With the `lock` option, no other process can write between the read and
   * the write, so a "set if missing" is safe across processes:
   *
   * ```js
   * const { installId } = config.update((store) =>
   *   store.installId ? store : { ...store, installId: randomUUID() }
   * )
   * ```
   *
   * @param {(store: SchemaValues<Schema>) => SchemaValues<Schema>} fn - Returns the new config.
   * @returns {SchemaValues<Schema>} The stored config.
   */
  update(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError(
        `Expected \`fn\` to be of type \`function\`, got ${typeof fn}`
      )
    }

    /** @type {SchemaValues<Schema> | undefined} */
    let result

    this.#mutate((store) => {
      const before = this.#serialize(store)
      const next = fn(store)

      if (next === null || typeof next !== 'object' || Array.isArray(next)) {
        throw new TypeError(
          `Expected \`fn\` to return the new config object, got ${setKeyType(next)}`
        )
      }

      const output = this.#validate(next, 'ERR_CONF_INVALID_VALUE')
      result = output
      return this.#serialize(output) === before ? undefined : output
    }, true)

    return /** @type {SchemaValues<Schema>} */ (result)
  }

  /**
   * Reset the config to the `defaults` option and schema default values.
   *
   * Does not read the current file, so it also replaces a corrupt or
   * schema-invalid file.
   */
  clear() {
    this.#replace(createPlainObject())
  }

  /**
   * Watch a config key for changes.
   *
   * @template {SchemaKeyPath<Schema>} Key
   * @param {Key} key - Item key. Supports dot notation when enabled.
   * @param {OnDidChangeCallback<SchemaValue<Schema, Key>>} callback - Called with `(newValue, oldValue)`.
   * @returns {Unsubscribe} Unsubscribe function.
   */
  onDidChange(key, callback) {
    if (typeof key !== 'string') {
      throw new TypeError(
        `Expected \`key\` to be of type \`string\`, got ${typeof key}`
      )
    }

    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`callback\` to be of type \`function\`, got ${typeof callback}`
      )
    }

    return this.#subscribe(
      (store) =>
        /** @type {SchemaValue<Schema, Key>} */ (this.#getIn(store, key)),
      callback
    )
  }

  /**
   * Watch the entire config object for changes.
   *
   * @param {OnDidAnyChangeCallback<SchemaValues<Schema>>} callback - Called with `(newValue, oldValue)`.
   * @returns {Unsubscribe} Unsubscribe function.
   */
  onDidAnyChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`callback\` to be of type \`function\`, got ${typeof callback}`
      )
    }

    return this.#subscribe(
      (store) => store,
      /** @type {OnDidChangeCallback<SchemaValues<Schema>>} */ (callback)
    )
  }

  /** Number of top-level config items. */
  get size() {
    return Object.keys(this.store).length
  }

  /**
   * Get or replace the full config object.
   *
   * Reading this property loads and validates the config file from disk.
   */
  get store() {
    return this.#load(this.#readFile())
  }

  /**
   * Validates `value` and persists the schema output. Missing top-level keys
   * are filled from the `defaults` option and schema defaults.
   *
   * Does not read the current file, so it also replaces a corrupt or
   * schema-invalid file.
   *
   * @param {SchemaValues<Schema>} value
   */
  set store(value) {
    this.#replace(value)
  }

  /**
   * Iterate over config entries as `[key, value]` pairs.
   *
   * @returns {Generator<SchemaEntry<Schema>, void, unknown>}
   */
  *[Symbol.iterator]() {
    for (const [key, value] of Object.entries(this.store)) {
      const entry = /** @type {SchemaEntry<Schema>} */ ([key, value])
      yield entry
    }
  }

  /**
   * Close the file watcher if one exists.
   *
   * Useful in tests to prevent the process from hanging.
   */
  _closeWatcher() {
    if (this.#watcher) {
      this.#watcher.close()
      this.#watcher = undefined
    }

    if (this.#watchFile) {
      fs.unwatchFile(this.path)
      this.#watchFile = false
    }

    this.#debouncedChangeHandler?.cancel()
    this.#debouncedChangeHandler = undefined
  }

  /**
   * Read the raw config file.
   *
   * @returns {string | undefined} File contents, or `undefined` when the file does not exist.
   */
  #readFile() {
    try {
      return fs.readFileSync(this.path, 'utf8')
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
        return undefined
      }

      throw error
    }
  }

  /**
   * Deserialize and validate raw config file contents into a new store object.
   *
   * @param {string | undefined} data - Raw file contents from `#readFile`.
   * @returns {SchemaValues<Schema>}
   */
  #load(data) {
    return this.#parse(data).value
  }

  /**
   * Deserialize and validate raw config file contents.
   *
   * A missing file loads as an empty config with defaults applied. So does an
   * invalid file when `clearInvalidConfig` is enabled, and then `invalid` is
   * `true`.
   *
   * @param {string | undefined} data - Raw file contents from `#readFile`.
   * @returns {{ value: SchemaValues<Schema>, invalid: boolean }}
   */
  #parse(data) {
    if (data !== undefined) {
      try {
        return { value: this.#parseFile(data), invalid: false }
      } catch (error) {
        if (!(error instanceof ConfError && this.#options.clearInvalidConfig)) {
          throw error
        }
      }
    }

    return {
      value: this.#validate(createPlainObject(), 'ERR_CONF_SCHEMA'),
      invalid: data !== undefined,
    }
  }

  /**
   * Deserialize and validate existing config file contents.
   *
   * @param {string} data - Raw file contents from `#readFile`.
   * @returns {SchemaValues<Schema>}
   * @throws {ConfError} `ERR_CONF_PARSE` or `ERR_CONF_SCHEMA` when invalid.
   */
  #parseFile(data) {
    /** @type {unknown} */
    let raw

    try {
      raw = this.#deserialize(data)
    } catch (error) {
      throw new ConfError(
        'ERR_CONF_PARSE',
        `Config file ${this.path} could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
        { path: this.path, cause: error }
      )
    }

    return this.#validate(
      Object.assign(createPlainObject(), raw),
      'ERR_CONF_SCHEMA'
    )
  }

  /**
   * Load the current store, pass it to `update` and persist the result.
   *
   * @param {(store: SchemaValues<Schema>) => SchemaValues<Schema> | undefined} update -
   *   Returns the new store, or `undefined` to skip the write.
   * @param {boolean} [validated] - Whether `update` returns schema output that
   *   is persisted as is.
   */
  #mutate(update, validated = false) {
    const written = this.#locked(() => {
      const { value, invalid } = this.#parse(this.#readFile())
      const next = update(value)

      if (next === undefined) {
        return false
      }

      this.#save(next, invalid, validated)
      return true
    })

    if (written) {
      this.events.dispatchEvent(new Event('change'))
    }
  }

  /**
   * Replace the store with `value` without loading the current file.
   *
   * With `clearInvalidConfig`, the file is still read to back it up when it
   * is invalid.
   *
   * @param {SchemaValues<Schema>} value
   */
  #replace(value) {
    this.#locked(() => {
      let invalid = false
      const data = this.#options.clearInvalidConfig
        ? this.#readFile()
        : undefined

      if (data !== undefined) {
        try {
          this.#parseFile(data)
        } catch (error) {
          if (!(error instanceof ConfError)) {
            throw error
          }

          invalid = true
        }
      }

      this.#save(value, invalid)
    })

    this.events.dispatchEvent(new Event('change'))
  }

  /**
   * Run `fn` while holding the lock file when the `lock` option is enabled.
   *
   * @template T
   * @param {() => T} fn
   * @returns {T}
   */
  #locked(fn) {
    const { lock } = this.#options

    if (!lock) {
      return fn()
    }

    const { timeout = 1000, stale = 10_000 } = lock === true ? {} : lock
    // The lock file lives next to the config file.
    this.#ensureDirectory()
    const release = lockSync(`${this.path}.lock`, { timeout, stale })

    if (!release) {
      throw new ConfError(
        'ERR_CONF_LOCKED',
        `Timed out after ${timeout} ms waiting for the lock on config file ${this.path}`,
        { path: this.path }
      )
    }

    try {
      return fn()
    } finally {
      release()
    }
  }

  /**
   * Validate and persist `value`.
   *
   * @param {SchemaValues<Schema>} value
   * @param {boolean} invalid - Whether the current file is invalid and must be
   *   backed up before it is replaced.
   * @param {boolean} [validated] - Whether `value` is already schema output,
   *   so it is persisted without validating it again.
   */
  #save(value, invalid, validated = false) {
    const output = validated
      ? value
      : this.#validate(value, 'ERR_CONF_INVALID_VALUE')

    // The output is read back as schema input on the next load, so it must
    // pass validation again or the file could never be loaded.
    if (this.#schema) {
      try {
        this.#validate(output, 'ERR_CONF_INVALID_VALUE')
      } catch (error) {
        throw new TypeError(
          `Schema output must be valid schema input to be stored. ${/** @type {Error} */ (error).message}`,
          { cause: error }
        )
      }
    }

    if (invalid) {
      this.#backup()
    }

    this.#ensureDirectory()
    this.#write(output)
  }

  /**
   * Copy the config file to `<name>.invalid-<timestamp>.<ext>` next to it,
   * with mode `configFileMode`.
   */
  #backup() {
    const extension = this.#options.fileExtension
      ? `.${this.#options.fileExtension}`
      : ''
    const basename = path.basename(this.path)
    const name = basename.slice(0, basename.length - extension.length)
    const stamp = Date.now()

    for (let attempt = 0; ; attempt++) {
      const suffix = attempt === 0 ? '' : `-${attempt}`
      const backupPath = path.join(
        path.dirname(this.path),
        `${name}.invalid-${stamp}${suffix}${extension}`
      )

      try {
        fs.copyFileSync(this.path, backupPath, fs.constants.COPYFILE_EXCL)
      } catch (error) {
        const code = /** @type {NodeJS.ErrnoException} */ (error).code

        if (code === 'EEXIST') {
          continue
        }

        // Another process replaced the invalid file first.
        if (code === 'ENOENT') {
          return
        }

        throw error
      }

      try {
        fs.chmodSync(backupPath, this.#options.configFileMode ?? 0o600)
      } catch (error) {
        if (!isUnsupportedChange(error)) {
          throw error
        }
      }

      return
    }
  }

  /**
   * Fresh copy of the `defaults` option.
   *
   * @returns {Record<string, unknown>}
   */
  #defaults() {
    if (this.#defaultsData === undefined) {
      return createPlainObject()
    }

    return Object.assign(
      createPlainObject(),
      this.#deserialize(this.#defaultsData)
    )
  }

  /**
   * Resolve the default value for a key in `store`.
   *
   * Uses the `defaults` option when it has the key, otherwise validates a copy
   * of `store` without the key so the schema can fill in its default.
   *
   * @param {SchemaValues<Schema>} store - Loaded config object.
   * @param {string} key - Item key. Supports dot notation when enabled.
   */
  #defaultFor(store, key) {
    const value = this.#getIn(this.#defaults(), key)

    if (value !== undefined) {
      return value
    }

    /** @type {Record<string, unknown>} */
    const probe = Object.assign(
      createPlainObject(),
      this.#deserialize(this.#serialize(store))
    )

    if (this.#options.accessPropertiesByDotNotation) {
      deleteProperty(probe, key)
    } else {
      delete probe[key]
    }

    try {
      return this.#getIn(this.#validate(probe, 'ERR_CONF_SCHEMA'), key)
    } catch {
      // The key is required and has no default.
      return undefined
    }
  }

  /**
   * Read a config value from an already loaded store.
   *
   * @param {Record<string, unknown>} store - Loaded config object.
   * @param {string} key - Item key. Supports dot notation when enabled.
   * @param {unknown} [defaultValue] - Value returned when the item does not exist.
   */
  #getIn(store, key, defaultValue) {
    if (this.#options.accessPropertiesByDotNotation) {
      return getProperty(store, key, defaultValue)
    }

    return key in store ? store[key] : defaultValue
  }

  /**
   * Write a config value into an already loaded store without persisting it.
   *
   * @param {Record<string, unknown>} store - Loaded config object to mutate.
   * @param {string} key - Item key. Supports dot notation when enabled.
   * @param {unknown} value - Value to set.
   */
  #setIn(store, key, value) {
    checkValueType(key, value)

    if (this.#options.accessPropertiesByDotNotation) {
      setProperty(store, key, value)
    } else if (
      key !== '__proto__' &&
      key !== 'constructor' &&
      key !== 'prototype'
    ) {
      store[key] = value
    }
  }

  /**
   * Read the config file once per `change` event and share it across listeners.
   *
   * `store` is only for change detection and must never reach callbacks.
   * Listeners that fire get their own copy by loading `data` again.
   *
   * A read failure is dispatched as an `error` event once per `change` event
   * and returns `null`.
   *
   * @param {Event} event - The `change` event being dispatched.
   */
  #changeSnapshot(event) {
    let snapshot = this.#changeSnapshots.get(event)

    if (snapshot === undefined) {
      try {
        const data = this.#readFile()
        snapshot = { data, store: this.#load(data) }
      } catch (error) {
        snapshot = null
        this.#dispatchError(error)
      }

      this.#changeSnapshots.set(event, snapshot)
    }

    return snapshot
  }

  /**
   * Dispatch an `error` event with `error` as its `detail`.
   *
   * @param {unknown} error
   */
  #dispatchError(error) {
    this.events.dispatchEvent(new CustomEvent('error', { detail: error }))
  }

  /**
   * Merge the `defaults` option under `data` and validate the result against
   * the schema when present.
   *
   * @param {object} data - Config object to validate.
   * @param {ConfErrorCode} code - Error code for a validation failure.
   * @returns {SchemaValues<Schema>}
   */
  #validate(data, code) {
    const input = Object.assign(this.#defaults(), data)

    if (!this.#schema) {
      return /** @type {SchemaValues<Schema>} */ (input)
    }

    return /** @type {SchemaValues<Schema>} */ (
      validateSchema(this.#schema, input, code, this.path)
    )
  }

  /** Ensure the config directory exists. */
  #ensureDirectory() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true })
  }

  /**
   * Write config data to disk atomically.
   *
   * Snap packages get no special case. `sindresorhus/conf` wrote directly to
   * the file when `SNAP` was set, to work around its old atomic writer under
   * Snap confinement, but a direct write truncates the file first, so
   * concurrent readers and writers see and leave corrupt files. The atomic
   * writer only creates, syncs and renames a temporary file in the config
   * folder, which confinement rules for the config file also cover, and it
   * tolerates `chmod` and `chown` failures.
   *
   * @param {StandardSchemaV1.InferOutput<Schema>} value - Config object to persist.
   */
  #write(value) {
    writeFileAtomicSync(
      this.path,
      this.#serialize(value),
      this.#options.configFileMode
    )
  }

  /**
   * Subscribe to change events for the value selected by `getter`.
   *
   * @template Value
   * @param {(store: SchemaValues<Schema>) => Value} getter - Selects the watched value from a store.
   * @param {OnDidChangeCallback<Value>} callback
   * @returns {Unsubscribe}
   */
  #subscribe(getter, callback) {
    let currentValue = getter(this.store)

    /** @type {EventListener} */
    const onChange = (event) => {
      try {
        const snapshot = this.#changeSnapshot(event)

        if (
          snapshot === null ||
          isDeepStrictEqual(getter(snapshot.store), currentValue)
        ) {
          return
        }

        const oldValue = currentValue
        const newValue = getter(this.#load(snapshot.data))
        currentValue = newValue
        callback.call(this, newValue, oldValue)
      } catch (error) {
        this.#dispatchError(error)
      }
    }

    this.events.addEventListener('change', onChange)

    return () => {
      this.events.removeEventListener('change', onChange)
    }
  }

  /** @type {Deserialize} */
  #deserialize = (value) => parse(value)

  /** @type {Serialize} */
  #serialize = (value) => stringify(value, '\t')

  /**
   * Normalize constructor options and apply defaults.
   *
   * @param {Options<Schema>} partialOptions
   * @returns {Options<Schema>}
   */
  #prepareOptions(partialOptions) {
    /** @type {Options<Schema>} */
    const options = {
      configName: 'config',
      fileExtension: 'json',
      projectSuffix: 'nodejs',
      clearInvalidConfig: false,
      accessPropertiesByDotNotation: true,
      configFileMode: 0o600,
      ...partialOptions,
    }

    if (!options.cwd) {
      if (!options.projectName) {
        throw new Error('Please specify the `projectName` option.')
      }

      options.cwd = configDirectory(
        kebabCase(options.projectName),
        options.projectSuffix ?? 'nodejs'
      )
    }

    if (typeof options.fileExtension === 'string') {
      options.fileExtension = options.fileExtension.replace(/^\.+/, '')
    }

    if (options.lock && options.lock !== true) {
      for (const name of /** @type {const} */ (['timeout', 'stale'])) {
        const value = options.lock[name]

        if (
          value !== undefined &&
          (typeof value !== 'number' || Number.isNaN(value) || value < 0)
        ) {
          throw new TypeError(
            `Expected \`lock.${name}\` to be a non-negative number, got ${String(value)}`
          )
        }
      }
    }

    if (options.serialize) {
      this.#serialize = options.serialize
    }

    if (options.deserialize) {
      this.#deserialize = options.deserialize
    }

    return options
  }

  /**
   * Resolve the absolute config file path.
   *
   * @param {Options<Schema>} options
   * @returns {string}
   */
  #resolvePath(options) {
    const fileExtension = options.fileExtension
      ? `.${options.fileExtension}`
      : ''
    return path.resolve(
      options.cwd ?? process.cwd(),
      `${options.configName ?? 'config'}${fileExtension}`
    )
  }

  /**
   * Watch the config file for external changes.
   *
   * `fs.watch` needs an existing target, so this creates an empty config file
   * when there is none. It is the only constructor option that writes.
   */
  #watch() {
    this.#ensureDirectory()

    if (!fs.existsSync(this.path)) {
      this.#write(createPlainObject())
    }

    if (process.platform === 'win32' || process.platform === 'darwin') {
      this.#debouncedChangeHandler ??= debounce(() => {
        this.events.dispatchEvent(new Event('change'))
      }, 100)

      const directory = path.dirname(this.path)
      const basename = path.basename(this.path)

      this.#watcher = fs.watch(
        directory,
        { persistent: false, encoding: 'utf8' },
        (_eventType, filename) => {
          if (filename && filename !== basename) {
            return
          }

          this.#debouncedChangeHandler?.()
        }
      )

      this.#watcher.on('error', (error) => {
        this._closeWatcher()
        this.#dispatchError(error)
      })
    } else {
      this.#debouncedChangeHandler ??= debounce(() => {
        this.events.dispatchEvent(new Event('change'))
      }, 1000)

      fs.watchFile(this.path, { persistent: false }, () => {
        this.#debouncedChangeHandler?.()
      })
      this.#watchFile = true
    }
  }
}

/**
 * Debounce a function call.
 *
 * @param {() => void} fn - Function to debounce.
 * @param {number} wait - Delay in milliseconds.
 */
function debounce(fn, wait) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timeout

  const cancel = () => {
    clearTimeout(timeout)
    timeout = undefined
  }

  const debounced = () => {
    cancel()
    timeout = setTimeout(() => {
      timeout = undefined
      fn()
    }, wait)
  }

  return Object.assign(debounced, { cancel })
}
