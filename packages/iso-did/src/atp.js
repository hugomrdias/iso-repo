import { resolve as doh } from 'iso-web/doh'
import { request } from 'iso-web/http'
import pRace from 'p-race'
import { parse } from '../src/index.js'
import { DIRECTORY, isPlc, resolve as resolvePlc } from './plc.js'
import { didWebResolver } from './web.js'

const SUBDOMAIN = '_atproto'

/**
 * @param {Object} options
 * @param {import('did-resolver').ParsedDID} options.parsed
 * @param {AbortSignal} [options.signal]
 */
export async function resolveDNS(options) {
  const records = await doh(`${SUBDOMAIN}.${options.parsed.id}`, 'TXT', {
    signal: options.signal,
  })

  if (records.error) {
    throw records.error
  }

  const dids = new Set()

  for (const record of records.result) {
    if (!record.startsWith('did=')) {
      continue
    }

    const did = record.slice(4)

    if (isAtpDid(did)) {
      dids.add(did)
    }
  }

  if (dids.size === 0) {
    return undefined
  }

  if (dids.size > 1) {
    throw new Error('Multiple ATP DIDs found')
  }

  return Array.from(dids)[0]
}

/**
 * @param {Object} options
 * @param {import('did-resolver').ParsedDID} options.parsed
 * @param {AbortSignal} [options.signal]
 */
export async function resolveHttp(options) {
  const url = `https://${options.parsed.id}/.well-known/atproto-did`

  const rsp = await request.get(url, {
    signal: options.signal,
  })

  if (rsp.error) {
    throw rsp.error
  }

  const did = (await rsp.result.text()).trim()

  if (isAtpDid(did)) {
    return did
  }

  return undefined
}

/**
 * @param {Object} options
 * @param {import('did-resolver').ParsedDID} options.parsed
 */
export async function resolvePlcDid(options) {
  /** @type {string | undefined} */
  const r = await pRace((signal) => [
    resolveDNS({
      ...options,
      signal,
    }),
    resolveHttp({
      ...options,
      signal,
    }),
  ])

  return r
}

/**
 * Resolves a did:atp DID, attempting resolution via DNS, well-known, and then falling back to did:plc or did:web.
 *
 * @param {object} options - Options for resolving the DID.
 * @param {string} options.directory - The directory to use for resolving did:plc DIDs.
 * @param {import('did-resolver').ParsedDID} options.parsed - The parsed DID object.
 * @param {import('did-resolver').DIDResolutionOptions} options.options - Options for the DID resolver.
 * @returns {Promise<import('did-resolver').DIDResolutionResult>} - A promise that resolves to the DID resolution result.
 *
 * @example
 * ```ts twoslash
 * // @filename: index.ts
 * import { resolve } from 'iso-did/atp'
 * import { parse } from 'iso-did'
 *
 * async function example() {
 *   const didResolutionResult = await resolve({
 *     directory: 'https://plc.directory',
 *     parsed: parse('did:atp:retr0.id'),
 *     options: {}
 *   })
 *
 *   console.log(didResolutionResult.didDocument?.id)
 *   // => did:plc:vwzwgnygau7ed7b7wt5ux7y2
 * }
 * ```
 */
export async function resolve(options) {
  try {
    // resolve did in dns or well-known
    const did = await resolvePlcDid({
      parsed: options.parsed,
    })

    if (did == null) {
      return {
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: 'DID not found',
        },
        didDocument: null,
      }
    }

    // resolve did:plc
    const plc = await resolvePlc({
      directory: options.directory,
      parsed: parse(did),
      options: options.options,
    })

    // if did:plc fails, try did:web
    if (plc.didResolutionMetadata.error) {
      return await didWebResolver(
        `did:web:${options.parsed.id}`,
        parse(`did:web:${options.parsed.id}`),
        // @ts-expect-error - testing
        {},
        options.options
      )
    }

    return plc
  } catch (error) {
    return {
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
        // @ts-expect-error - error.message is not typed
        message: error.message,
      },
      didDocument: null,
    }
  }
}

/**
 * Check if a DID is a valid ATP DID
 *
 * @param {string} did
 * @returns {boolean}
 *
 * @example
 * ```ts twoslash
 * import { isAtpDid } from 'iso-did/atp'
 *
 * // when the did is a plc
 * isAtpDid('did:plc:ewvi7nxzyoun6zhxrhs64oiz')
 * //=> true
 *
 * // when the did is a web
 * isAtpDid('did:web:robin.berjon.com')
 * //=> true
 *
 * // when the did is invalid
 * isAtpDid('did:key:z6MkmTBzK2JeYogW35ws63V9E9F66ayWTzoP62i7EL7e7VsZ')
 * //=> false
 * ```
 */
function isAtpDid(did) {
  const parsed = parse(did)

  if (parsed == null) {
    return false
  }

  if (parsed.method === 'web') {
    return true
  }

  if (parsed.method === 'plc' && isPlc(parsed.did)) {
    return true
  }

  return false
}

/**
 * Creates a DID resolver for `did:atp` method.
 *
 * This resolver uses either DNS or well-known endpoints to resolve the DID,
 * eventually resolving to a `did:plc` DID.
 *
 * @param {string} [directory=DIRECTORY] - The directory to use for resolving `did:plc` DIDs.
 * @returns {import('did-resolver').DIDResolver} A DID resolver for `did:atp` method.
 *
 * @example
 * ```ts twoslash
 * import { createDidAtpResolver } from 'iso-did/atp'
 * import { resolve } from 'iso-did'
 *
 * const didDocument = await resolve('did:atp:retr0.id', {
 *   resolvers: {
 *     atp: createDidAtpResolver('https://plc.directory')
 *   },
 *   cache: true
 * })
 * console.log(didDocument)
 * ```
 */
export function createAtpResolver(directory = DIRECTORY) {
  /** @type {import('did-resolver').DIDResolver} */
  function didAtpResolver(_did, parsedDid, _resolver, options) {
    return resolve({
      directory,
      parsed: parsedDid,
      options,
    })
  }

  return didAtpResolver
}
