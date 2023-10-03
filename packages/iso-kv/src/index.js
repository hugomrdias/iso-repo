/**
 * @typedef {import('./types').KvStorageAdapter} KvStorageAdapter
 * @typedef {import('./types').Kv} Kv
 * @typedef {import('./types').KvKey} KvKey
 */

import { MemoryStorageAdapter } from './adapters/memory.js'

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
  return key.join(':')
}

/**
 * @param {string} key
 */
function split(key) {
  return key.split(':')
}

/**
 * UTC Unix timestamp in seconds
 */
export const now = () => Math.floor(Date.now() / 1000)

/**
 * @class KV
 *
 * @implements {Kv}
 */
export class KV {
  #subs
  /**
   * @param {import('./types').Options} [options]
   */
  constructor(options = {}) {
    this.store = options.store ?? new MemoryStorageAdapter()
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
    const raw = await /** @type {typeof this.store.get<T>} */ (this.store.get)(
      join(key)
    )

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
   * @param {number} [ttl] - Time to live in seconds
   */
  async set(key, value, ttl) {
    if (value === undefined) {
      return this
    }

    if (ttl === 0) {
      ttl = undefined
    }

    // eslint-disable-next-line unicorn/no-null
    const expires = typeof ttl === 'number' ? now() + ttl : null

    await this.#handleChange(key, value)
    await this.store.set(join(key), { value, expires })
    return this
  }

  /** @type {Kv['delete']} */
  async delete(key) {
    await this.#handleChange(key)
    return this.store.delete(join(key))
  }

  /** @type {Kv['has']} */
  async has(key) {
    return (await this.get(key)) !== undefined
  }

  async clear() {
    for await (const { key } of this.store) {
      await this.delete(split(key))
    }
  }

  /**
   * @template [Value=unknown]
   * @returns {AsyncIterableIterator<{key: KvKey, value: Value}>}
   */
  async *[Symbol.asyncIterator]() {
    for await (const { key: _key, value: data } of this.store) {
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
   * @template [Value=unknown]
   * @param {import('./types').KvListSelector} selector
   * @param {import('./types').KvListOptions} [options]
   * @returns {import('./types').KvListIterator<import('./types').KvEntry<Value>>}
   */
  async *list(selector, options = {}) {
    const { limit, reverse } = options
    let count = 0
    const data = []

    for await (const { key, value } of this) {
      const keyString = join(key)
      if (
        'start' in selector &&
        keyString.localeCompare(selector.start.join(':')) < 0
      ) {
        continue
      }

      if (
        'end' in selector &&
        keyString.localeCompare(selector.end.join(':')) >= 0
      ) {
        continue
      }

      if (
        'prefix' in selector &&
        !keyString.startsWith(selector.prefix.join(':') + ':')
      ) {
        continue
      }

      data.push({ key, value })

      count++
      if (limit !== undefined && count >= limit) {
        return
      }
    }

    if (reverse) {
      data.reverse()
    }

    for (const item of data) {
      yield /** @type {import('./types').KvEntry} */ (item)
    }
  }
}
