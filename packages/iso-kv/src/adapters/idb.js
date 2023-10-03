import { clear, createStore, del, entries, get, set } from 'idb-keyval'

/**
 * @typedef {import('../types').KvStorageAdapter} KvStorageAdapter
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
 * @implements {KvStorageAdapter}
 */
export class IDBStorageAdapter {
  /**
   * @param {{name?: string}} [config]
   */
  constructor(config = {}) {
    this.name = config.name ?? 'iso-kv'
    this.store = createStore(this.name, this.name)
  }

  /**
   * @type {KvStorageAdapter['set']}
   */
  async set(key, value) {
    await set(key, value, this.store)
    return this
  }

  /**
   * @template [Value=unknown]
   * @param {string} key
   */
  get(key) {
    return get(key, this.store)
  }

  /** @type {KvStorageAdapter['delete']} */
  delete(key) {
    return del(key, this.store)
  }

  /** @type {KvStorageAdapter['has']} */
  async has(key) {
    const value = await get(key, this.store)
    return value !== undefined
  }

  clear() {
    return clear(this.store)
  }

  /**
   * @returns {AsyncIterableIterator<{key: string, value: unknown}>}
   */
  async *[Symbol.asyncIterator]() {
    const data = await entries(this.store)
    for (const [key, value] of data) {
      yield {
        key: asKey(key),
        value,
      }
    }
  }
}
