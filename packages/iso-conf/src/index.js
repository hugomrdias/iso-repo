import assert from 'node:assert'
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

/**
 * Returns whether a value is not `undefined`.
 *
 * @param {unknown} data
 */
const isExist = (data) => data !== undefined

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

  /** @type {Partial<StandardSchemaV1.InferOutput<Schema>>} */
  #defaultValues = createPlainObject()

  /** @type {fs.FSWatcher | undefined} */
  #watcher

  /** @type {boolean | undefined} */
  #watchFile

  /** @type {(() => void) | undefined} */
  #debouncedChangeHandler

  /**
   * Creates a new config store.
   *
   * @param {Options<Schema>} [partialOptions] - Config options.
   */
  constructor(partialOptions = {}) {
    const options = this.#prepareOptions(partialOptions)
    this.#options = options
    this.#schema = options.schema
    this.#applyDefaultValues(options)
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
   * @param {string} key - Item key. Supports dot notation when enabled.
   * @param {unknown} [defaultValue] - Value returned when the item does not exist.
   */
  get(key, defaultValue) {
    if (this.#options.accessPropertiesByDotNotation) {
      return this.#get(key, defaultValue)
    }

    /** @type {Record<string, unknown>} */
    const store = this.store
    return key in store ? store[key] : defaultValue
  }

  /**
   * Set one or more config items.
   *
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

    /** @type {Record<string, unknown>} */
    const store = this.store

    /**
     * @param {string} itemKey
     * @param {unknown} itemValue
     */
    const set = (itemKey, itemValue) => {
      checkValueType(itemKey, itemValue)

      if (this.#options.accessPropertiesByDotNotation) {
        setProperty(store, itemKey, itemValue)
      } else if (
        itemKey !== '__proto__' &&
        itemKey !== 'constructor' &&
        itemKey !== 'prototype'
      ) {
        store[itemKey] = itemValue
      }
    }

    if (typeof key === 'object') {
      for (const [itemKey, itemValue] of Object.entries(key)) {
        set(itemKey, itemValue)
      }
    } else {
      set(key, value)
    }

    this.store = /** @type {StandardSchemaV1.InferOutput<Schema>} */ (store)
  }

  /**
   * Check whether a config item exists.
   *
   * @param {string} key - Item key. Supports dot notation when enabled.
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
   * @param {string} key - Array key. Supports dot notation when enabled.
   * @param {unknown} value - Item to append.
   */
  appendToArray(key, value) {
    const keyPath = String(key)
    checkValueType(keyPath, value)

    const array = this.#options.accessPropertiesByDotNotation
      ? this.#get(keyPath, [])
      : keyPath in this.store
        ? this.store[keyPath]
        : []

    if (!Array.isArray(array)) {
      throw new TypeError(
        `The key \`${keyPath}\` is already set to a non-array value`
      )
    }

    this.set(keyPath, [...array, value])
  }

  /**
   * Reset items to their schema default values.
   *
   * @param {...string} keys - Keys to reset.
   */
  reset(...keys) {
    for (const key of keys) {
      if (isExist(this.#defaultValues[key])) {
        this.set(key, this.#defaultValues[key])
      }
    }
  }

  /**
   * Delete a config item.
   *
   * @param {string} key - Item key. Supports dot notation when enabled.
   */
  delete(key) {
    /** @type {Record<string, unknown>} */
    const store = this.store

    if (this.#options.accessPropertiesByDotNotation) {
      deleteProperty(store, key)
    } else {
      delete store[key]
    }

    this.store = /** @type {StandardSchemaV1.InferOutput<Schema>} */ (store)
  }

  /**
   * Reset the config to schema default values.
   */
  clear() {
    /** @type {Record<string, unknown>} */
    const newStore = createPlainObject()

    for (const key of Object.keys(this.#defaultValues)) {
      if (isExist(this.#defaultValues[key])) {
        checkValueType(key, this.#defaultValues[key])

        if (this.#options.accessPropertiesByDotNotation) {
          setProperty(newStore, key, this.#defaultValues[key])
        } else {
          newStore[key] = this.#defaultValues[key]
        }
      }
    }

    this.store = /** @type {StandardSchemaV1.InferOutput<Schema>} */ (newStore)
  }

  /**
   * Watch a config key for changes.
   *
   * @param {string} key - Item key. Supports dot notation when enabled.
   * @param {OnDidChangeCallback} callback - Called with `(newValue, oldValue)`.
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

    return this.#handleValueChange(() => this.get(key), callback)
  }

  /**
   * Watch the entire config object for changes.
   *
   * @param {OnDidAnyChangeCallback<StandardSchemaV1.InferOutput<Schema>>} callback - Called with `(newValue, oldValue)`.
   * @returns {Unsubscribe} Unsubscribe function.
   */
  onDidAnyChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`callback\` to be of type \`function\`, got ${typeof callback}`
      )
    }

    return this.#handleStoreChange(callback)
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
    try {
      const data = fs.readFileSync(this.path, 'utf8')
      const deserializedData = this.#deserialize(data)
      return this.#parseStore(deserializedData)
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
        this.#ensureDirectory()
        return createPlainObject()
      }

      if (this.#options.clearInvalidConfig) {
        const errorInstance = /** @type {Error} */ (error)

        if (errorInstance.name === 'SyntaxError') {
          return createPlainObject()
        }

        if (
          errorInstance instanceof SchemaError ||
          errorInstance.message?.startsWith('Config schema violation')
        ) {
          return createPlainObject()
        }
      }

      throw error
    }
  }

  /** @param {StandardSchemaV1.InferOutput<Schema>} value */
  set store(value) {
    this.#ensureDirectory()
    this.#validate(value)
    this.#write(value)
    this.events.dispatchEvent(new Event('change'))
  }

  /** Iterate over config entries as `[key, value]` pairs. */
  *[Symbol.iterator]() {
    for (const [key, value] of Object.entries(this.store)) {
      yield [key, value]
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
   * Get a nested config value using dot notation.
   *
   * @param {string} key - Dot-notated key.
   * @param {unknown} [defaultValue] - Value returned when the item does not exist.
   */
  #get(key, defaultValue) {
    return getProperty(this.store, key, defaultValue)
  }

  /**
   * Parse deserialized config data and validate it.
   *
   * @param {unknown} data - Parsed config object.
   * @returns {StandardSchemaV1.InferOutput<Schema>}
   */
  #parseStore(data) {
    const store = Object.assign(createPlainObject(), data)
    return this.#validate(store)
  }

  /**
   * Validate config data against the schema when present.
   *
   * @param {unknown} data - Config object to validate.
   * @returns {StandardSchemaV1.InferOutput<Schema>}
   */
  #validate(data) {
    if (!this.#schema) {
      return /** @type {StandardSchemaV1.InferOutput<Schema>} */ (data)
    }

    return /** @type {StandardSchemaV1.InferOutput<Schema>} */ (
      validateSchema(this.#schema, data)
    )
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
   * Subscribe to full-store change events.
   *
   * @param {OnDidAnyChangeCallback<StandardSchemaV1.InferOutput<Schema>>} callback
   * @returns {Unsubscribe}
   */
  #handleStoreChange(callback) {
    let currentValue = this.store

    /** @type {EventListener} */
    const onChange = () => {
      const oldValue = currentValue
      const newValue = this.store

      if (isDeepStrictEqual(newValue, oldValue)) {
        return
      }

      currentValue = newValue
      callback.call(this, newValue, oldValue)
    }

    this.events.addEventListener('change', onChange)

    return () => {
      this.events.removeEventListener('change', onChange)
    }
  }

  /**
   * Subscribe to single-key change events.
   *
   * @param {() => unknown} getter - Returns the current value for the watched key.
   * @param {OnDidChangeCallback} callback
   * @returns {Unsubscribe}
   */
  #handleValueChange(getter, callback) {
    let currentValue = getter()

    /** @type {EventListener} */
    const onChange = () => {
      const oldValue = currentValue
      const newValue = getter()

      if (isDeepStrictEqual(newValue, oldValue)) {
        return
      }

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
      configFileMode: 0o666,
      ...partialOptions,
    }

    if (!options.cwd) {
      if (!options.projectName) {
        throw new Error('Please specify the `projectName` option.')
      }

      options.cwd = envPaths(options.projectName, {
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
   * Capture schema default values for `reset` and `clear`.
   *
   * @param {Options<Schema>} options
   */
  #applyDefaultValues(options) {
    if (options.schema) {
      try {
        const value = validateSchema(options.schema, {})
        if (value && typeof value === 'object') {
          Object.assign(this.#defaultValues, value)
        }
      } catch {
        // Ignore invalid empty defaults.
      }
    }
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

  /** Merge schema defaults into the on-disk config when needed. */
  #initializeStore() {
    const fileStore = this.store
    let storeWithDefaults = Object.assign(createPlainObject(), fileStore)

    if (this.#schema) {
      storeWithDefaults = this.#validate(storeWithDefaults)
    }

    try {
      assert.deepEqual(fileStore, storeWithDefaults)
    } catch {
      this.store = storeWithDefaults
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
