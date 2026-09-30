import { KV } from 'iso-kv'
import { MemoryDriver } from 'iso-kv/drivers/memory.js'

/**
 * @import {Driver} from 'iso-kv'
 * @import {ReplayStore} from './types.js'
 */

/**
 * Replay store backed by an `iso-kv` driver.
 *
 * Keys are kept until the invocation expires, or forever when the invocation
 * has no expiration.
 *
 * `checkAndSet` is atomic within one JavaScript realm only: calls are
 * serialized through an in-process queue. When several processes or instances
 * share a driver, implement {@link ReplayStore} on top of an atomic
 * set-if-absent operation instead (for example Redis `SET NX` or SQL
 * `INSERT ... ON CONFLICT DO NOTHING`).
 *
 * @implements {ReplayStore}
 */
export class KVReplayStore {
  /** @type {KV} */
  kv

  /** @type {Promise<unknown>} */
  #queue = Promise.resolve()

  /**
   * @param {Driver} [driver] - Defaults to a {@link MemoryDriver}.
   */
  constructor(driver = new MemoryDriver()) {
    this.kv = new KV({ driver })
  }

  /**
   * Record `key` and return `true`, or return `false` if it was already
   * recorded and has not expired.
   *
   * @param {string} key
   * @param {number | null} expiration - Unix time in seconds, or `null` to keep forever
   * @returns {Promise<boolean>}
   */
  checkAndSet(key, expiration) {
    const result = this.#queue.then(async () => {
      if (await this.kv.has([key])) {
        return false
      }
      await this.kv.set([key], true, { expiration })
      return true
    })
    this.#queue = result.catch(() => {
      // Errors are reported to the caller, keep the queue going
    })
    return result
  }
}
