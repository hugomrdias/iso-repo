/**
 * @typedef {import('./types').SchemaConstrains} SchemaConstrains
 * @typedef {import('./types').SchemaDefault} SchemaDefault
 * @typedef {import('./types').DefaultRecord} Default
 * @typedef {import('./types').Store} Store
 */

/**
 * @template {Default} S
 * @typedef {import('./types').IKv<S>} IKv
 */

const noop = (/** @type {any} */ v) => v
/**
 * @class KV
 *
 * @template {SchemaConstrains} [A=SchemaDefault]
 * @template {import('zod').infer<A>} [T=import('zod').infer<A>]
 * @implements {IKv<T>}
 */
export class KV {
  #subs
  /**
   * @param {import('./types').Options<A>} options
   */
  constructor(options) {
    this.store = options.store
    this.ttl = options.ttl
    this.serialize = options.serialize ?? noop
    this.deserialize = options.deserialize ?? noop
    this.schema = options.schema
    this.#subs = new Map()
  }

  /**
   * @template {keyof T} Key
   * @param {Key} key - Key to watch
   * @param {(newValue?: T[Key], oldValue?: T[Key]) => void} callback
   * @param {boolean} [once]
   */
  onChange(key, callback, once) {
    if (typeof key !== 'string') {
      throw new TypeError(
        `Expected \`key\` to be of type \`string\`, got ${typeof key}`
      )
    }

    if (typeof callback !== 'function') {
      throw new TypeError(
        `Expected \`fn\` to be of type \`function\`, got ${typeof callback}`
      )
    }

    let handlers = this.#subs.get(key)
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
      this.#subs.set(key, handlers)
    }

    return () => {
      handlers?.splice(handlers.indexOf(handler) >>> 0, 1)
    }
  }

  /**
   * @template {keyof T} Key
   * @param {Key} key
   * @param {T[key]} [newValue]
   */
  async #handleChange(key, newValue) {
    const handlers = this.#subs.get(key)
    if (handlers) {
      for (const handler of handlers) {
        handler.call(this, newValue, await this.get(key))
      }
    }
  }

  /**
   * @template {keyof T} Key
   * @param {Key} key
   * @returns {Promise<T[Key] | undefined>}
   */
  async get(key) {
    const raw = await this.store.get(key)
    if (raw) {
      const data = await this.deserialize(raw)

      if (typeof data.expires === 'number' && Date.now() > data.expires) {
        this.delete(key)
      } else {
        return data.value
      }
    }
  }

  /**
   * @template {keyof T} Key
   * @param {Key} key
   * @param {T[Key]} value
   * @param {number} [ttl]
   */
  async set(key, value, ttl = this.ttl) {
    if (value === undefined) {
      return false
    }

    if (this.schema) {
      if ('pick' in this.schema) {
        // @ts-ignore
        this.schema.pick({ [key]: true }).parse({ [key]: value })
      } else {
        this.schema.parse({ [key]: value })
      }

      if (ttl === 0) {
        ttl = undefined
      }
    }

    // eslint-disable-next-line unicorn/no-null
    const expires = typeof ttl === 'number' ? Date.now() + ttl : null

    const serialized = await this.serialize({ value, expires })

    await this.#handleChange(key, value)
    // @ts-ignore
    await this.store.set(key, serialized)
    return true
  }

  /** @type {IKv<T>['clear']} */
  async clear() {
    for (const [key, handlers] of this.#subs) {
      if (handlers) {
        for (const handler of handlers) {
          handler.call(this, undefined, await this.get(key))
        }
      }
    }

    return this.store.clear()
  }

  /** @type {IKv<T>['delete']} */
  async delete(key) {
    await this.#handleChange(key)
    return this.store.delete(key)
  }

  /** @type {IKv<T>['has']} */
  async has(key) {
    return (await this.get(key)) !== undefined
  }

  /**
   * @template {keyof T} Key
   * @returns {AsyncIterableIterator<[Key, T[Key]]>}
   */
  async *[Symbol.asyncIterator]() {
    // @ts-ignore
    for await (const [key] of this.store) {
      const value = await this.get(key)
      if (value !== undefined) {
        yield [key, value]
      }
    }
  }
}

/**
 * @param {import('./types').DeserializedData<unknown>} data
 */
export function serialize(data) {
  return JSON.stringify(data)
}

/**
 * @param {unknown} data
 */
export function deserialize(data) {
  // @ts-ignore
  return JSON.parse(data)
}
