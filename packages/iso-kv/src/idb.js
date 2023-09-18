import { set, get, del, clear, entries, createStore } from 'idb-keyval'

/**
 * @typedef {import('../src/types.js').Store} Store
 * @typedef {import('../src/types.js').DefaultKey} DefaultKey
 */

/**
 * @class IDBStore
 * @implements {Store}
 */
export class IDBStore {
  /**
   * @param {{name?: string}} [config]
   */
  constructor(config = {}) {
    this.name = config.name ?? 'iso-kv'
    this.store = createStore(this.name, this.name)
  }

  /**
   * @param {DefaultKey} key
   */
  async get(key) {
    if (typeof key === 'symbol') {
      key = key.toString()
    }
    return get(key, this.store)
  }

  /**
   * @param {DefaultKey} key
   * @param {any} value
   */
  async set(key, value) {
    if (typeof key === 'symbol') {
      key = key.toString()
    }
    await set(key, value, this.store)

    return store
  }

  /**
   * @param {DefaultKey} key
   */
  async delete(key) {
    if (typeof key === 'symbol') {
      key = key.toString()
    }

    await del(key, this.store)
  }

  /**
   * @param {DefaultKey} key
   */
  async has(key) {
    if (typeof key === 'symbol') {
      key = key.toString()
    }
    const value = await get(key, this.store)
    return value !== undefined
  }

  async clear() {
    return clear(this.store)
  }

  /**
   * @returns {AsyncIterableIterator<[import('./types.js').DefaultKey, any]>}
   */
  async *[Symbol.asyncIterator]() {
    const all = await entries(this.store)
    // @ts-ignore
    for (const [key, value] of all) {
      yield [key.toString(), value]
    }
  }
}

/**
 * @type {import('./types.js').Store}
 */
export const store = new IDBStore()
