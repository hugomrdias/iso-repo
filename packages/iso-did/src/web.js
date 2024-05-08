import { request } from 'iso-web/http'

// eslint-disable-next-line no-unused-vars
import * as T from './types.js'

/** @type {import('did-resolver').DIDResolver} */
export async function didWebResolver(did, parsedDid) {
  let path = parsedDid.id.replaceAll(':', '/')

  if (path.includes('%3A')) {
    // if path contains encoded colon
    path = path.replaceAll('%3A', ':') // replace encoded colon with colon
  }

  let url = `https://${path}`

  if (parsedDid.id.split(':').length === 1) {
    url = `${url}/.well-known`
  }

  url = `${url}/did.json`

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
      // eslint-disable-next-line unicorn/no-null
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
      // eslint-disable-next-line unicorn/no-null
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
  web: didWebResolver,
}
