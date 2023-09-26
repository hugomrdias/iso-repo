/**
 * @typedef {import('./types').KvStorageAdapter} KvStorageAdapter
 * @typedef {import('./types').Kv} Kv
 * @typedef {import('./types').KvKey} KvKey
 */

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
 * @class KV
 *
 * @implements {Kv}
 */
export class KV {
  #subs
  /**
   * @param {import('./types').Options} options
   */
  constructor(options) {
    this.store = options.store
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

    const keyString = key.join(':')

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
    const handlers = this.#subs.get(key.join(':'))
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
      key
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
      if (typeof data.expires === 'number' && Date.now() > data.expires) {
        this.delete(key)
      } else {
        return data.value
      }
    }
  }

  /**
   * @template [T=unknown]
   * @param {KvKey} key
   * @param {T} value
   * @param {number} [ttl]
   */
  async set(key, value, ttl) {
    if (value === undefined) {
      return this
    }

    if (ttl === 0) {
      ttl = undefined
    }

    // eslint-disable-next-line unicorn/no-null
    const expires = typeof ttl === 'number' ? Date.now() + ttl : null

    await this.#handleChange(key, value)
    await this.store.set(key, { value, expires })
    return this
  }

  /** @type {Kv['delete']} */
  async delete(key) {
    await this.#handleChange(key)
    return this.store.delete(key)
  }

  /** @type {Kv['has']} */
  async has(key) {
    return (await this.get(key)) !== undefined
  }

  async clear() {
    for await (const { key } of this.store) {
      await this.delete(key)
    }
  }

  /**
   * @template [Value=unknown]
   * @returns {AsyncIterableIterator<{key: KvKey, value: Value}>}
   */
  async *[Symbol.asyncIterator]() {
    for await (const { key, value: data } of this.store) {
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
      const keyString = key.join(':')
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
