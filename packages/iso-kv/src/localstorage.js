/**
 * @typedef {import('../src/types.js').Store} Store
 */
const LSKEY = 'iso-kv'

/**
 * @param {import('./types').DeserializedData<unknown>} data
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
 * @implements {Store}
 */
export class LocalStorageStore {
  #store
  /**
   *
   * @param {string} name
   */
  constructor(name = LSKEY) {
    this.name = name
    const ls = localStorage.getItem(LSKEY)

    this.#store = ls ? new Map(deserialize(ls)) : new Map()
  }

  /**
   * @param {import('../src/types.js').DefaultKey} key
   */
  get(key) {
    return this.#store.get(key)
  }

  /**
   * @param {import('../src/types.js').DefaultKey} key
   */
  has(key) {
    return this.#store.has(key)
  }

  /**
   * @param {import('../src/types.js').DefaultKey} key
   * @param {unknown} value
   */
  set(key, value) {
    this.#store.set(key, value)
    const obj = Object.fromEntries(this.#store)
    localStorage.setItem(this.name, serialize(obj))

    return this
  }

  /**
   * @param {import('../src/types.js').DefaultKey} key
   */
  delete(key) {
    this.#store.delete(key)
    const obj = Object.fromEntries(this.#store)
    localStorage.setItem(this.name, serialize(obj))
  }

  clear() {
    this.#store.clear()
    // @ts-ignore
    localStorage.setItem(this.name, serialize({}))
  }

  /**
   * @returns {IterableIterator<[import('../src/types.js').DefaultKey, any]>}
   */
  *[Symbol.iterator]() {
    // @ts-ignore
    for (const [key, value] of this.#store) {
      yield [key.toString(), value]
    }
  }
}

export const store = new LocalStorageStore()
