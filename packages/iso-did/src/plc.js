import { request } from 'iso-web/http'

import * as T from './types.js'

/**
 * @see {@link https://plc.directory}
 *
 * Spec {@link https://web.plc.directory/spec/v0.1/did-plc}
 */

const DIRECTORY = 'https://plc.directory'

export function createDidPlcResolver(directory = DIRECTORY) {
  /** @type {import('did-resolver').DIDResolver} */
  async function didPlcResolver(did, parsedDid) {
    const url = `${directory}/${parsedDid.did}`

    const resolve = await /** @type {typeof request.json<T.DIDDocument>} */ (
      request.json
    )(url)

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

    if (resolve.result.id !== did) {
      return {
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `DID mismatch: ${resolve.result.id} !== ${did}`,
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

  return didPlcResolver
}

/** @type {import('did-resolver').ResolverRegistry} */
export const resolver = {
  plc: createDidPlcResolver(),
}
