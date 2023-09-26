/**
 * @typedef {import('../types').KvStorageAdapter} KvStorageAdapter
 * @typedef {import('../types').KvKey} KvKey
 */

import { MemoryStorageAdapter } from './memory.js'

/**
 * @param {unknown} data
 */
export function serialize(data) {
  return JSON.stringify(data)
}

/**
 * @param {unknown} data
 */
export function deserialize(data) {
  // @ts-ignore
  return JSON.parse(data)
}

/**
 * @class
 * @implements {KvStorageAdapter}
 */
export class WebStorageAdapter extends MemoryStorageAdapter {
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
   * @type {KvStorageAdapter['set']}
   */
  set(key, value) {
    super.set(key, value)
    const obj = Object.fromEntries(this.map)
    this.storage.setItem(this.name, serialize(obj))
    return this
  }

  /** @type {KvStorageAdapter['delete']} */
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
