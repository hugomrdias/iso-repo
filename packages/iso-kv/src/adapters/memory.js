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
    this.map.set(key.join(':'), value)
    return this
  }

  /**
   * @template [Value=unknown]
   * @param {KvKey} key
   */
  get(key) {
    return /** @type {Value | undefined} */ (this.map.get(key.join(':')))
  }

  /** @type {KvStorageAdapter['delete']} */
  delete(key) {
    this.map.delete(key.join(':'))
  }

  /** @type {KvStorageAdapter['has']} */
  has(key) {
    return this.map.has(key.join(':'))
  }

  clear() {
    this.map.clear()
  }

  /**
   * @returns {AsyncIterableIterator<import('../types').KvEntry>}
   */
  async *[Symbol.asyncIterator]() {
    const data = [...this.map].sort(([k1], [k2]) => k1.localeCompare(k2))
    for (const [key, value] of data) {
      yield {
        key: key.split(':'),
        value,
      }
    }
  }

  /**
   * @template [Value=unknown]
   * @param {import('../types').KvListSelector} selector
   * @param {import('../types').KvListOptions} [options]
   * @returns {Iterator<import('../types').KvEntry>}
   */
  *list(selector, options = {}) {
    const { limit, reverse } = options

    let count = 0
    const data = [...this.map].sort(([k1], [k2]) => k1.localeCompare(k2))
    if (reverse) {
      data.reverse()
    }

    for (const [key, value] of data) {
      if (
        'start' in selector &&
        key.localeCompare(selector.start.join(':')) < 0
      ) {
        continue
      }

      if ('end' in selector && key.localeCompare(selector.end.join(':')) >= 0) {
        continue
      }

      if (
        'prefix' in selector &&
        !key.startsWith(selector.prefix.join(':') + ':')
      ) {
        continue
      }

      yield {
        key: key.split(':'),
        value,
      }

      count++
      if (limit !== undefined && count >= limit) {
        return
      }
    }
  }
}
