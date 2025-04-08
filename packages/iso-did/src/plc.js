import { request } from 'iso-web/http'

import * as T from './types.js'

/**
 * @see {@link https://plc.directory}
 *
 * Spec {@link https://web.plc.directory/spec/v0.1/did-plc}
 */

export const DIRECTORY = 'https://plc.directory'

export function createPlcResolver(directory = DIRECTORY) {
  /** @type {import('did-resolver').DIDResolver} */
  function didPlcResolver(_did, parsedDid, _resolver, options = {}) {
    return resolve({
      directory,
      parsed: parsedDid,
      options,
    })
  }

  return didPlcResolver
}

/**
 * @param {Object} options
 * @param {string} options.directory
 * @param {import('did-resolver').ParsedDID} options.parsed
 * @param {import('did-resolver').DIDResolutionOptions} options.options
 */
export async function resolve(options) {
  const url = new URL(
    `/${encodeURIComponent(options.parsed.didUrl)}`,
    options.directory
  )

  const resolve = await /** @type {typeof request.json<T.DIDDocument>} */ (
    request.json
  )(url, {
    headers: options.options.accept ? { accept: options.options.accept } : {},
  })
  if (resolve.error) {
    return {
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
        message: resolve.error.message,
      },
      didDocument: null,
    }
  }

  if (resolve.result.id !== options.parsed.did) {
    return {
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
        message: `DID mismatch: ${resolve.result.id} !== ${options.parsed.did}`,
      },
      didDocument: null,
    }
  }

  return {
    didDocumentMetadata: {},
    didResolutionMetadata: {
      contentType: resolve.result['@context']
        ? 'application/did+ld+json'
        : 'application/did+json',
    },
    didDocument: resolve.result,
  }
}

/** @type {import('did-resolver').ResolverRegistry} */
export const resolver = {
  plc: createPlcResolver(),
}

export const PLC_DID_RE = /^did:plc:([a-z2-7]{24})$/

/**
 * Check if the input is a valid PLC DID
 *
 * @param {string } input
 */
export function isPlc(input) {
  return input.length === 32 && PLC_DID_RE.test(input)
}
