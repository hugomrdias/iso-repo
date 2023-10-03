/**
 * @typedef {import('../types').KvStorageAdapter} KvStorageAdapter
 * @typedef {import('../types').KvKey} KvKey
 */

/**
 * @class
 * @implements {KvStorageAdapter}
 */
export class MemoryStorageAdapter {
  /** @type {Map<string,unknown>} */
  map

  /**
   *
   * @param {Map<string,unknown>} [map]
   */
  constructor(map) {
    /** @type {Map<string,unknown>} */
    this.map = map ?? new Map()
  }

  /**
   * @type {KvStorageAdapter['set']}
   */
  set(key, value) {
    this.map.set(key, value)
    return this
  }

  /**
   * @template [Value=unknown]
   * @param {string} key
   */
  get(key) {
    return /** @type {Value | undefined} */ (this.map.get(key))
  }

  /** @type {KvStorageAdapter['delete']} */
  delete(key) {
    this.map.delete(key)
  }

  /** @type {KvStorageAdapter['has']} */
  has(key) {
    return this.map.has(key)
  }

  clear() {
    this.map.clear()
  }

  /**
   * @returns {AsyncIterableIterator<{key: string, value: unknown}>}
   */
  async *[Symbol.asyncIterator]() {
    const data = [...this.map].sort(([k1], [k2]) => k1.localeCompare(k2))
    for (const [key, value] of data) {
      yield {
        key,
        value,
      }
    }
  }
}
