import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { getDotPath, SchemaError } from '@standard-schema/utils'
import { writeFileSync as atomicWriteFileSync } from 'atomically'
import { deleteProperty, getProperty, hasProperty, setProperty } from 'dot-prop'
import envPaths from 'env-paths'
import { parse, stringify } from 'iso-base/json'

/**
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 * @import {
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
  /[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]+/
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
 * Validates a value against a Standard Schema.
 *
 * @param {StandardSchemaV1} schema - Schema to validate against.
 * @param {unknown} value - Value to validate.
 */
const validateSchema = (schema, value) => {
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
    const error = new SchemaError(result.issues)
    error.message = `Config schema violation: ${message}`
    throw error
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

  /** Event target used for change notifications. */
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

  /** @type {(() => void) | undefined} */
  #debouncedChangeHandler

  /**
   * Store snapshots shared by all listeners of a single `change` event.
   *
   * @type {WeakMap<Event, { data: string | undefined, store: SchemaValues<Schema> }>}
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
    this.#initializeStore()

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
    if (typeof key !== 'string' && typeof key !== 'object') {
      throw new TypeError(
        `Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`
      )
    }

    if (typeof key !== 'object' && value === undefined) {
      throw new TypeError('Use `delete()` to clear values')
    }

    const store = this.store

    if (typeof key === 'object') {
      for (const [itemKey, itemValue] of Object.entries(key)) {
        this.#setIn(store, itemKey, itemValue)
      }
    } else {
      this.#setIn(store, key, value)
    }

    this.store = store
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

    const store = this.store
    const array = this.#getIn(store, keyPath, [])

    if (!Array.isArray(array)) {
      throw new TypeError(
        `The key \`${keyPath}\` is already set to a non-array value`
      )
    }

    this.#setIn(store, keyPath, [...array, value])
    this.store = store
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
    const store = this.store
    let changed = false

    for (const key of keys) {
      const keyPath = String(key)
      const value = this.#defaultFor(store, keyPath)

      if (value !== undefined) {
        this.#setIn(store, keyPath, value)
        changed = true
      }
    }

    if (changed) {
      this.store = store
    }
  }

  /**
   * Delete a config item.
   *
   * @param {SchemaKeyPath<Schema>} key - Item key. Supports dot notation when enabled.
   */
  delete(key) {
    const keyPath = String(key)
    const store = this.store

    if (this.#options.accessPropertiesByDotNotation) {
      deleteProperty(store, keyPath)
    } else {
      delete store[keyPath]
    }

    this.store = store
  }

  /**
   * Reset the config to the `defaults` option and schema default values.
   */
  clear() {
    this.store = createPlainObject()
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
   * @param {SchemaValues<Schema>} value
   */
  set store(value) {
    this.#persist(this.#validate(value))
    this.events.dispatchEvent(new Event('change'))
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
        this.#ensureDirectory()
        return undefined
      }

      throw error
    }
  }

  /**
   * Build a new validated store object from raw file contents.
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
   * `raw` is the deserialized file, or an empty object when the file is
   * missing or was discarded by `clearInvalidConfig` (then `cleared` is
   * `true`). `value` is always the validated store.
   *
   * @param {string | undefined} data - Raw file contents from `#readFile`.
   * @returns {{ raw: Record<string, unknown>, value: SchemaValues<Schema>, cleared?: boolean }}
   */
  #parse(data) {
    if (data !== undefined) {
      try {
        /** @type {Record<string, unknown>} */
        const raw = Object.assign(createPlainObject(), this.#deserialize(data))
        return { raw, value: this.#validate(raw) }
      } catch (error) {
        if (!this.#options.clearInvalidConfig) {
          throw error
        }
      }
    }

    /** @type {Record<string, unknown>} */
    const raw = createPlainObject()
    return { raw, value: this.#validate(raw), cleared: data !== undefined }
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
      return this.#getIn(this.#validate(probe), key)
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
   * @param {Event} event - The `change` event being dispatched.
   */
  #changeSnapshot(event) {
    let snapshot = this.#changeSnapshots.get(event)

    if (!snapshot) {
      const data = this.#readFile()
      snapshot = { data, store: this.#load(data) }
      this.#changeSnapshots.set(event, snapshot)
    }

    return snapshot
  }

  /**
   * Merge the `defaults` option under `data` and validate the result against
   * the schema when present.
   *
   * @param {object} data - Config object to validate.
   * @returns {SchemaValues<Schema>}
   */
  #validate(data) {
    const input = Object.assign(this.#defaults(), data)

    if (!this.#schema) {
      return /** @type {SchemaValues<Schema>} */ (input)
    }

    return /** @type {SchemaValues<Schema>} */ (
      validateSchema(this.#schema, input)
    )
  }

  /**
   * Write validated schema output to disk.
   *
   * The output is read back as schema input on the next load, so it must pass
   * validation again or the file could never be loaded.
   *
   * @param {SchemaValues<Schema>} value - Validated config object.
   */
  #persist(value) {
    if (this.#schema) {
      try {
        this.#validate(value)
      } catch (error) {
        throw new TypeError(
          `Schema output must be valid schema input to be stored. ${/** @type {Error} */ (error).message}`,
          { cause: error }
        )
      }
    }

    this.#ensureDirectory()
    this.#write(value)
  }

  /** Ensure the config directory exists. */
  #ensureDirectory() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true })
  }

  /**
   * Write config data to disk atomically.
   *
   * @param {StandardSchemaV1.InferOutput<Schema>} value - Config object to persist.
   */
  #write(value) {
    const data = this.#serialize(value)

    if (process.env.SNAP) {
      fs.writeFileSync(this.path, data, {
        mode: this.#options.configFileMode,
      })
      return
    }

    try {
      atomicWriteFileSync(this.path, data, {
        mode: this.#options.configFileMode,
      })
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EXDEV') {
        fs.writeFileSync(this.path, data, {
          mode: this.#options.configFileMode,
        })
        return
      }

      throw error
    }
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
      const snapshot = this.#changeSnapshot(event)

      if (isDeepStrictEqual(getter(snapshot.store), currentValue)) {
        return
      }

      const oldValue = currentValue
      const newValue = getter(this.#load(snapshot.data))
      currentValue = newValue
      callback.call(this, newValue, oldValue)
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

      options.cwd = envPaths(kebabCase(options.projectName), {
        suffix: options.projectSuffix ?? 'nodejs',
      }).config
    }

    if (typeof options.fileExtension === 'string') {
      options.fileExtension = options.fileExtension.replace(/^\.+/, '')
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
    const fileExtension =
      typeof options.fileExtension === 'string'
        ? `.${options.fileExtension}`
        : ''
    return path.resolve(
      options.cwd ?? process.cwd(),
      `${options.configName ?? 'config'}${fileExtension}`
    )
  }

  /**
   * Persist defaults and normalised schema output into the on-disk config when
   * needed, and replace a file discarded by `clearInvalidConfig`.
   */
  #initializeStore() {
    const { raw, value, cleared } = this.#parse(this.#readFile())

    // Schemas may return a plain object for our null-prototype input, so only
    // compare the top level by own properties.
    if (
      cleared ||
      !isDeepStrictEqual(raw, Object.assign(createPlainObject(), value))
    ) {
      this.#persist(value)
    }
  }

  /** Watch the config file for external changes. */
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

  return () => {
    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(fn, wait)
  }
}
