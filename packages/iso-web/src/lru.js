const SEPARATOR = ' '

/**
 * @param {string | string[]} key
 */
function toId(key) {
  return typeof key === 'string' ? key : key.join(SEPARATOR)
}

/**
 * In-memory cache that keeps at most `max` entries, evicting the least
 * recently used one first. Entries can expire after a `ttl`.
 *
 * Array keys are joined with a space, so `['a', 'b']` and `'a b'` are the same key.
 *
 * @template [V=unknown]
 *
 * @example
 * ```ts
 * import { LRUCache } from 'iso-web/lru'
 *
 * const cache = new LRUCache<string>({ max: 500 })
 * cache.set('key', 'value', { ttl: 60 })
 * cache.get('key') // 'value'
 * ```
 *
 * @example
 * ```ts
 * import { resolve } from 'iso-web/doh'
 * import { LRUCache } from 'iso-web/lru'
 *
 * const cache = new LRUCache({ max: 5000 })
 * const { result } = await resolve('example.com', 'A', { cache })
 * ```
 */
export class LRUCache {
  /** @type {Map<string, { value: V, expires: number }>} */
  #entries = new Map()

  /** @type {number} */
  #max

  /**
   * @param {object} [options]
   * @param {number} [options.max] - Maximum number of entries, defaults to 1000
   */
  constructor(options = {}) {
    const { max = 1000 } = options
    if (!Number.isInteger(max) || max < 1) {
      throw new RangeError('`max` must be a positive integer')
    }
    this.#max = max
  }

  /**
   * Number of entries, including expired ones not yet evicted
   */
  get size() {
    return this.#entries.size
  }

  /**
   * @param {string | string[]} key
   * @returns {V | undefined}
   */
  get(key) {
    const id = toId(key)
    const entry = this.#entries.get(id)
    if (!entry) {
      return
    }

    // re-insert to mark it as the most recently used
    this.#entries.delete(id)
    if (Date.now() >= entry.expires) {
      return
    }
    this.#entries.set(id, entry)
    return entry.value
  }

  /**
   * @param {string | string[]} key
   * @param {V} value
   * @param {{ ttl?: number }} [options] - `ttl` in seconds, values not greater than 0 are not cached. Without a `ttl` the entry only leaves the cache when evicted.
   */
  set(key, value, options = {}) {
    const id = toId(key)
    const { ttl } = options
    this.#entries.delete(id)
    if (ttl !== undefined && !(ttl > 0)) {
      return this
    }

    this.#entries.set(id, {
      value,
      expires:
        ttl === undefined ? Number.POSITIVE_INFINITY : Date.now() + ttl * 1000,
    })
    if (this.#entries.size > this.#max) {
      // Map iterates in insertion order, so the first key is the least recently used
      const oldest = this.#entries.keys().next().value
      if (oldest !== undefined) {
        this.#entries.delete(oldest)
      }
    }
    return this
  }

  /**
   * @param {string | string[]} key
   */
  delete(key) {
    this.#entries.delete(toId(key))
  }

  clear() {
    this.#entries.clear()
  }
}
