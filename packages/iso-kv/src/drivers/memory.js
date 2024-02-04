/**
 * @typedef {import('../types').DriverSync} DriverSync
 * @typedef {import('../types').KvKey} KvKey
 */

/**
 * @class
 * @implements {DriverSync}
 */
export class MemoryDriver {
  /** @type {Map<string,any>} */
  map

  /**
   *
   * @param {Map<string,unknown>} [map]
   */
  constructor(map) {
    /** @type {Map<string,any>} */
    this.map = map ?? new Map()
  }

  /**
   * @type {DriverSync['set']}
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

  /** @type {DriverSync['delete']} */
  delete(key) {
    this.map.delete(key)
  }

  /** @type {DriverSync['has']} */
  has(key) {
    return this.map.has(key)
  }

  clear() {
    this.map.clear()
  }

  /**
   * @returns {IterableIterator<[string, unknown]>}
   */
  *[Symbol.iterator]() {
    const data = [...this.map].sort(([k1], [k2]) => k1.localeCompare(k2))
    for (const [key, value] of data) {
      yield [key, value]
    }
  }
}
