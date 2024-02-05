/**
 * @typedef {import('./types').Driver} Driver
 * @typedef {import('./types').IKV} IKV
 * @typedef {import('./types').KvKey} KvKey
 */

import { MemoryDriver } from './drivers/memory.js'

const SEPARATOR = ' '

/**
 *
 * @param {unknown} value
 * @returns {value is import('./types').KVStoredValue}
 */
function checkValue(value) {
  if (
    value &&
    typeof value === 'object' &&
    'value' in value &&
    'expires' in value
  ) {
    return true
  }

  throw new TypeError('Invalid value')
}

/**
 * @param {KvKey} key
 */
function join(key) {
  return key
    .map((v) => {
      return v instanceof Date ? v.toISOString() : v.toString()
    })
    .join(SEPARATOR)
}

/**
 * @param {string} key
 */
function split(key) {
  return key.split(SEPARATOR)
}

/**
 * Unix timestamp in seconds
 */
const now = () => Math.floor(Date.now() / 1000)

/**
 * @class KV
 *
 * @implements {IKV}
 */
export class KV {
  /** @type {Driver} */
  #driver

  #subs
  /**
   * @param {import('./types').Options} [options]
   */
  constructor(options = {}) {
    this.#driver = options.driver ?? new MemoryDriver()
    this.#subs = new Map()
  }

  /**
   * @template [T=unknown]
   * @param {KvKey} key - Key to watch
   * @param {(newValue?: T, oldValue?: T) => void} callback
   * @param {boolean} [once]
   */
  onChange(key, callback, once) {
    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`fn\` to be of type \`function\`, got ${typeof callback}`
      )
    }

    const keyString = join(key)

    let handlers = this.#subs.get(keyString)
    let handler = callback

    if (once) {
      handler = (data) => {
        handlers?.splice(handlers.indexOf(handler) >>> 0, 1)
        Reflect.apply(callback, this, [data])
      }
    }

    if (handlers) {
      handlers.push(handler)
    } else {
      handlers = [handler]
      this.#subs.set(keyString, handlers)
    }

    return () => {
      handlers?.splice(handlers.indexOf(handler) >>> 0, 1)
    }
  }

  /**
   * @template [T=unknown]
   * @param {KvKey} key
   * @param {T} [newValue]
   */
  async #handleChange(key, newValue) {
    const handlers = this.#subs.get(join(key))
    if (handlers) {
      for (const handler of handlers) {
        handler.call(this, newValue, await this.get(key))
      }
    }
  }

  /**
   * @template [T=unknown]
   * @param {KvKey} key
   * @returns {Promise<T | undefined>}
   */
  async get(key) {
    const raw = await this.#driver.get(join(key))

    return this.#maybeExpire(key, raw)
  }

  /**
   * @template [T=unknown]
   * @param {KvKey} key
   * @param {unknown} [data]
   * @returns {T | undefined}
   */
  #maybeExpire(key, data) {
    if (data && checkValue(data)) {
      if (typeof data.expires === 'number' && now() > data.expires) {
        this.delete(key)
      } else {
        return data.value
      }
    }
  }

  /**
   * Set a value in the store
   *
   * @template [T=unknown]
   * @param {KvKey} key
   * @param {T} value
   * @param {import('./types').SetOptions} [options]
   */
  async set(key, value, options = {}) {
    if (value === undefined) {
      return this
    }

    const { ttl, expiration } = options

    // eslint-disable-next-line unicorn/no-null
    const expires = expiration ?? (typeof ttl === 'number' ? now() + ttl : null)

    await this.#handleChange(key, value)
    await this.#driver.set(join(key), { value, expires })
    return this
  }

  /** @type {IKV['delete']} */
  async delete(key) {
    await this.#handleChange(key)
    return this.#driver.delete(join(key))
  }

  /** @type {IKV['has']} */
  async has(key) {
    return (await this.get(key)) !== undefined
  }

  async clear() {
    for await (const [key] of this.#driver) {
      await this.delete(split(key))
    }
  }

  /**
   * @template [Value=unknown]
   * @returns {AsyncIterableIterator<{key: KvKey, value: Value}>}
   */
  async *[Symbol.asyncIterator]() {
    for await (const [_key, data] of this.#driver) {
      const key = split(_key)
      const _value = this.#maybeExpire(key, data)
      if (_value) {
        yield {
          key,
          value: /** @type {Value} */ (_value),
        }
      }
    }
  }

  /**
   * Retrieve a list of keys in the database
   *
   * Each list operation must specify a selector which is used to specify the range of keys to return. The selector can either be a prefix selector, or a range selector:
   *
   * - A prefix selector selects all keys that start with the given prefix of key parts. For example, the selector ["users"] will select all keys that start with the prefix ["users"], such as ["users", "alice"] and ["users", "bob"]. Note that you can not partially match a key part, so the selector ["users", "a"] will not match the key ["users", "alice"]. A prefix selector may specify a start key that is used to skip over keys that are lexicographically less than the start key.
   *
   * - A range selector selects all keys that are lexicographically between the given start and end keys (including the start, and excluding the end). For example, the selector ["users", "a"], ["users", "n"] will select all keys that start with the prefix ["users"] and have a second key part that is lexicographically between a and n, such as ["users", "alice"], ["users", "bob"], and ["users", "mike"], but not ["users", "noa"] or ["users", "zoe"].
   *
   * @template Value
   * @param {import('./types').KvListSelector} selector
   * @param {import('./types').KvListOptions} [options]
   * @returns {import('./types').KvListIterator<import('./types').KvEntry<Value>>}
   */
  async *list(selector, options = {}) {
    const { limit, reverse } = options
    let count = 0
    const data = []
    const all = []
    for await (const { key, value } of this) {
      all.push({ key, value })
    }

    all.sort((a, b) => join(a.key).localeCompare(join(b.key)))

    for (const { key, value } of all) {
      const keyString = join(key)
      if (
        'start' in selector &&
        keyString.localeCompare(join(selector.start)) < 0
      ) {
        continue
      }

      if (
        'end' in selector &&
        keyString.localeCompare(join(selector.end)) >= 0
      ) {
        continue
      }

      if (
        'prefix' in selector &&
        !keyString.startsWith(join(selector.prefix) + SEPARATOR)
      ) {
        continue
      }

      if (reverse) {
        data.push({ key, value })
      } else {
        yield /** @type {import('./types').KvEntry} */ ({ key, value })
      }

      count++
      if (limit !== undefined && count >= limit) {
        return
      }
    }

    if (reverse) {
      data.reverse()
      for (const item of data) {
        yield /** @type {import('./types').KvEntry} */ (item)
      }
    }
  }
}
