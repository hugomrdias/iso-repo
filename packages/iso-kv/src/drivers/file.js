import Conf from 'conf'
import { parse, stringify } from '../json.js'

/**
 * @typedef {import('../types.js').DriverSync} DriverSync
 */

/**
 * @class
 * @implements {DriverSync}
 */
export class FileDriver {
  /**
   * @param {import('conf').Options<Map<string, unknown>>} [config]
   */
  constructor(config = {}) {
    this.conf = new Conf({
      ...config,
      serialize: (value) => stringify(value),
      deserialize: (value) => parse(value),
      accessPropertiesByDotNotation: false,
    })
  }

  /**
   * @type {DriverSync['set']}
   */
  set(key, value) {
    this.conf.set(key, value)
    return this
  }

  /**
   * @type {DriverSync['get']}
   */
  get(key) {
    return /** @type {unknown} */ (this.conf.get(key))
  }

  /** @type {DriverSync['delete']} */
  delete(key) {
    // @ts-ignore
    return this.conf.delete(key)
  }

  /** @type {DriverSync['has']} */
  has(key) {
    // @ts-ignore
    return this.conf.has(key)
  }

  clear() {
    return this.conf.clear()
  }

  /**
   * @returns {IterableIterator<[string, unknown]>}
   */
  *[Symbol.iterator]() {
    const data = [...new Map(Object.entries(this.conf.store))].sort(
      ([k1], [k2]) => k1.localeCompare(k2)
    )

    for (const [key, value] of data) {
      yield [key, value]
    }
  }
}
