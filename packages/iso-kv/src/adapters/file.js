import Conf from 'conf'

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
 * @param {KvKey} key
 */
function encodeKey(key) {
  return key.join(':')
}

/**
 * @param {string} key
 */
function decodeKey(key) {
  return key.split(':')
}

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
    this.conf.set(encodeKey(key), value)
    return this
  }

  /**
   * @template [Value=unknown]
   * @param {KvKey} key
   */
  get(key) {
    return /** @type {Value | undefined} */ (this.conf.get(encodeKey(key)))
  }

  /** @type {KvStorageAdapter['delete']} */
  delete(key) {
    // @ts-ignore
    return this.conf.delete(encodeKey(key))
  }

  /** @type {KvStorageAdapter['has']} */
  async has(key) {
    return this.conf.has(encodeKey(key))
  }

  clear() {
    return this.conf.clear()
  }

  /**
   * @returns {AsyncIterableIterator<import('../types').KvEntry>}
   */
  async *[Symbol.asyncIterator]() {
    const data = [...new Map(Object.entries(this.conf.store))].sort(
      ([k1], [k2]) => k1.localeCompare(k2)
    )

    for (const [key, value] of data) {
      yield {
        key: decodeKey(key),
        value,
      }
    }
  }

  /**
   * @template [Value=unknown]
   * @param {import('../types').KvListSelector} selector
   * @param {import('../types').KvListOptions} [options]
   * @returns {AsyncIterator<import('../types').KvEntry>}
   */
  async *list(selector, options = {}) {
    const { limit, reverse } = options

    let count = 0
    const data = [...new Map(Object.entries(this.conf.store))].sort(
      ([k1], [k2]) => k1.localeCompare(k2)
    )
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
