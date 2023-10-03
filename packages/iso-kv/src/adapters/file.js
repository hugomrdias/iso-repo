import Conf from 'conf'

/**
 * @typedef {import('../types').KvStorageAdapter} KvStorageAdapter
 */

/**
 * @class
 * @implements {KvStorageAdapter}
 */
export class FileStorageAdapter {
  /**
   * @param {import('conf').Options<Map<string, unknown>>} [config]
   */
  constructor(config = {}) {
    this.conf = new Conf(config)
  }

  /**
   * @type {KvStorageAdapter['set']}
   */
  set(key, value) {
    this.conf.set(key, value)
    return this
  }

  /**
   * @template [Value=unknown]
   * @param {string} key
   */
  get(key) {
    return /** @type {Value | undefined} */ (this.conf.get(key))
  }

  /** @type {KvStorageAdapter['delete']} */
  delete(key) {
    // @ts-ignore
    return this.conf.delete(key)
  }

  /** @type {KvStorageAdapter['has']} */
  async has(key) {
    return this.conf.has(key)
  }

  clear() {
    return this.conf.clear()
  }

  /**
   * @returns {AsyncIterableIterator<{key: string, value: unknown}>}
   */
  async *[Symbol.asyncIterator]() {
    const data = [...new Map(Object.entries(this.conf.store))].sort(
      ([k1], [k2]) => k1.localeCompare(k2)
    )

    for (const [key, value] of data) {
      yield {
        key,
        value,
      }
    }
  }
}
