import { parseDIDURL } from './did-url.js'

/** @typedef {import('./types.js').DIDResolutionResult} DIDResolutionResult */

/**
 * @param {string} error
 * @returns {DIDResolutionResult}
 */
function failure(error) {
  return {
    didDocument: null,
    didDocumentMetadata: {},
    didResolutionMetadata: { error },
  }
}

/** Dispatch DID resolution to a registered method, with optional caching. */
export class Resolver {
  /** @type {import('./types.js').ResolverRegistry} */
  #registry
  /** @type {Map<string, DIDResolutionResult> | undefined} */
  #cache

  /**
   * @param {import('./types.js').ResolverRegistry} [registry]
   * @param {import('./types.js').ResolverOptions} [options]
   */
  constructor(registry = {}, options = {}) {
    this.#registry = registry
    this.#cache = options.cache ? new Map() : undefined
  }

  /**
   * @param {string} didUrl
   * @param {import('./types.js').DIDResolutionOptions} [options]
   * @returns {Promise<DIDResolutionResult>}
   */
  async resolve(didUrl, options = {}) {
    const parsed = parseDIDURL(didUrl)
    if (!parsed) return failure('invalidDid')
    if (!Object.hasOwn(this.#registry, parsed.method)) {
      return failure('unsupportedDidMethod')
    }
    const cache =
      parsed.params?.['no-cache'] === 'true' ? undefined : this.#cache
    const cached = cache?.get(didUrl)
    if (cached !== undefined) return cached

    const result = await this.#registry[parsed.method](
      parsed.did,
      parsed,
      this,
      options
    )
    if (result.didDocument && !result.didResolutionMetadata.error) {
      cache?.set(didUrl, result)
    }
    return result
  }
}
