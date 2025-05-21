/**
 * @typedef {import('../types').IResolver} IResolver
 */

import { hex } from 'iso-base/rfc4648'

/**
 * No cache
 *
 * @type {import('../types').Cache}
 */
function noCache(input, verify) {
  return verify(input)
}

/**
 * Memory cache factory
 *
 * @returns {import('../types').Cache}
 */
function memoryCache() {
  const cache = new Map()

  /** @type {import('../types').Cache} */
  async function fn(input, verify) {
    const key = `${input.did.verifiableDid.toString()}:${hex.encode(input.signature)}:${hex.encode(input.message)}`
    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = await verify(input)
    cache.set(key, result)
    return result
  }

  return fn
}

/**
 * Verifier resolver
 *
 * @implements {IResolver}
 */
export class Resolver {
  /**
   *
   * @param {import('../types').VerifierRegistry<import('../types').SignatureType>} registry
   * @param {import('../types').ResolverOptions} options
   */
  constructor(registry = {}, options = {}) {
    this.registry = registry
    this.cache =
      options.cache === true ? memoryCache() : options.cache || noCache
  }

  /** @type {IResolver['verify']} */
  verify(input) {
    const verify = this.registry[input.type]
    if (!verify) {
      throw new TypeError(`Unsupported signature type "${input.type}"`)
    }

    return this.cache(input, verify)
  }
}
