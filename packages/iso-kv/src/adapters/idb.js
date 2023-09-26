/* eslint-disable no-continue */
import { set, get, del, clear, entries, createStore } from 'idb-keyval'

/* eslint-disable object-shorthand */
/**
 * @typedef {import('../types').KvStorageAdapter} KvStorageAdapter
 * @typedef {import('../types').KvKey} KvKey
 */

/**
 *
 * @param {unknown} key
 * @returns { KvKey}
 */
function asKey(key) {
  return /** @type {KvKey} */ (key)
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
   * @template [Value = unknown]
   * @param {KvKey} key
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
   * @returns {AsyncIterableIterator<import('../types').KvEntry>}
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

  /**
   * @template [Value = unknown]
   * @param {import('../types').KvListSelector} selector
   * @param {import('../types').KvListOptions} [options]
   * @returns {AsyncIterator<import('../types').KvEntry>}
   */
  async *list(selector, options = {}) {
    const { limit, reverse } = options

    let count = 0
    const data = await entries(this.store)
    if (reverse) {
      data.reverse()
    }

    for (const [key, value] of data) {
      if (
        'start' in selector &&
        asKey(key).join(':').localeCompare(selector.start.join(':')) < 0
      ) {
        continue
      }

      if (
        'end' in selector &&
        asKey(key).join(':').localeCompare(selector.end.join(':')) >= 0
      ) {
        continue
      }

      if (
        'prefix' in selector &&
        !asKey(key)
          .join(':')
          .startsWith(selector.prefix.join(':') + ':')
      ) {
        continue
      }

      yield {
        key: asKey(key),
        value,
      }

      count++
      if (limit !== undefined && count >= limit) {
        return
      }
    }
  }
}
