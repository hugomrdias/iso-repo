import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'
import { getDotPath, SchemaError } from '@standard-schema/utils'
import { writeFileSync as atomicWriteFileSync } from 'atomically'
import { deleteProperty, getProperty, hasProperty, setProperty } from 'dot-prop'
import envPaths from 'env-paths'
import { parse, stringify } from './json.js'

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

/** @template T */
const createPlainObject = () => /** @type {T} */ (Object.create(null))

/** @param {unknown} data */
const isExist = (data) => data !== undefined

/**
 * @param {string} key
 * @param {unknown} value
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
 * @param {StandardSchemaV1} schema
 * @param {unknown} value
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
 * @template {StandardSchemaV1} Schema
 */
export class Conf {
  /** @type {string} */
  path

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
   * @param {Options<Schema>} [partialOptions]
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
   * @param {string} key
   * @param {unknown} [defaultValue]
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
   * @param {Record<string, unknown> | string} key
   * @param {unknown} [value]
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
   * @param {string} key
   */
  has(key) {
    const keyPath = String(key)

    if (this.#options.accessPropertiesByDotNotation) {
      return hasProperty(this.store, keyPath)
    }

    return keyPath in this.store
  }

  /**
   * @param {string} key
   * @param {unknown} value
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
   * @param {...string} keys
   */
  reset(...keys) {
    for (const key of keys) {
      if (isExist(this.#defaultValues[key])) {
        this.set(key, this.#defaultValues[key])
      }
    }
  }

  /**
   * @param {string} key
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
   * @param {string} key
   * @param {OnDidChangeCallback} callback
   * @returns {Unsubscribe}
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
   * @param {OnDidAnyChangeCallback<StandardSchemaV1.InferOutput<Schema>>} callback
   * @returns {Unsubscribe}
   */
  onDidAnyChange(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`callback\` to be of type \`function\`, got ${typeof callback}`
      )
    }

    return this.#handleStoreChange(callback)
  }

  get size() {
    return Object.keys(this.store).length
  }

  /** @type {StandardSchemaV1.InferOutput<Schema>} */
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

  *[Symbol.iterator]() {
    for (const [key, value] of Object.entries(this.store)) {
      yield [key, value]
    }
  }

  /**
   * Close the file watcher if one exists.
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
   * @param {string} key
   * @param {unknown} [defaultValue]
   */
  #get(key, defaultValue) {
    return getProperty(this.store, key, defaultValue)
  }

  /**
   * @param {unknown} data
   * @returns {StandardSchemaV1.InferOutput<Schema>}
   */
  #parseStore(data) {
    const store = Object.assign(createPlainObject(), data)
    return this.#validate(store)
  }

  /**
   * @param {unknown} data
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

  #ensureDirectory() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true })
  }

  /**
   * @param {StandardSchemaV1.InferOutput<Schema>} value
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
   * @param {() => unknown} getter
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
 * @param {() => void} fn
 * @param {number} wait
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
