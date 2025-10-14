/**
 * @typedef {import('../types.js').DriverSync} DriverSync
 * @typedef {import('../types.js').KvKey} KvKey
 */

import { parse, stringify } from '../json.js'
import { MemoryDriver } from './memory.js'

/**
 * @param {unknown} data
 */
export function serialize(data) {
  return stringify(data)
}

/**
 * @param {unknown} data
 */
export function deserialize(data) {
  // @ts-expect-error
  return parse(data)
}

/**
 * @class
 * @implements {DriverSync}
 */
export class WebStorageDriver extends MemoryDriver {
  /**
   *
   * @param {Storage} storage
   * @param {string} [name] - Name of the store
   */
  constructor(storage, name = 'iso-kv') {
    super(new Map())
    this.storage = storage
    this.name = name

    const data = this.storage.getItem(this.name)
    if (data) {
      const obj = deserialize(data)
      this.map = new Map(Object.entries(obj))
    }
  }

  /**
   * @type {DriverSync['set']}
   */
  set(key, value) {
    super.set(key, value)
    const obj = Object.fromEntries(this.map)
    this.storage.setItem(this.name, serialize(obj))
    return this
  }

  /** @type {DriverSync['delete']} */
  delete(key) {
    super.delete(key)
    const obj = Object.fromEntries(this.map)
    this.storage.setItem(this.name, serialize(obj))
  }

  clear() {
    super.clear()
    this.storage.setItem(this.name, serialize({}))
  }
}
