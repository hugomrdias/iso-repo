import { clear, createStore, del, entries, get, set } from 'idb-keyval'

/**
 * @typedef {import('../types').DriverAsync} DriverAsync
 * @typedef {import('../types').KvKey} KvKey
 */

/**
 *
 * @param {unknown} key
 * @returns {string}
 */
function asKey(key) {
  return /** @type {string} */ (key)
}

/**
 * @class
 * @implements {DriverAsync}
 */
export class IdbDriver {
  /**
   * @param {{name?: string}} [config]
   */
  constructor(config = {}) {
    this.name = config.name ?? 'iso-kv'
    this.store = createStore(this.name, this.name)
  }

  /**
   * @type {DriverAsync['set']}
   */
  async set(key, value) {
    await set(key, value, this.store)
    return this
  }

  /**
   * @type {DriverAsync['get']}
   */
  get(key) {
    return get(key, this.store)
  }

  /** @type {DriverAsync['delete']} */
  delete(key) {
    return del(key, this.store)
  }

  /** @type {DriverAsync['has']} */
  async has(key) {
    const value = await get(key, this.store)
    return value !== undefined
  }

  clear() {
    return clear(this.store)
  }

  /**
   * @returns {AsyncIterableIterator<[string, unknown]>}
   */
  async *[Symbol.asyncIterator]() {
    const data = await entries(this.store)
    for (const [key, value] of data) {
      yield [asKey(key), value]
    }
  }
}
