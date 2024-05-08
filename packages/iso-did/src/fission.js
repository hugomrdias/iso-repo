import { resolve } from 'iso-web/doh'

import { parse } from './index.js'
// @ts-ignore
// eslint-disable-next-line no-unused-vars
import * as T from './types.js'

/** @type {import('did-resolver').DIDResolver} */
export async function didFissionResolver(did, parsedDid) {
  const hostname = parsedDid.id.replaceAll('%3A', ':') // replace encoded colon with colon
  const server = hostname.includes('localhost')
    ? `http://${hostname}/dns-query`
    : `https://${hostname}/dns-query`

  const parsed = new URL(`http://${hostname}`)
  const records = await resolve(`_did.${parsed.hostname}`, 'TXT', {
    server,
  })

  if (records.result && records.result.length === 1) {
    const didKey = parse(records.result[0])
    const id = `${did}#${parsedDid.id}`

    return {
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
      didDocument: {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/multikey/v1',
        ],
        id: did,
        verificationMethod: [
          {
            id,
            type: 'MultiKey',
            controller: did,
            publicKeyMultibase: didKey.id,
          },
        ],
        authentication: [id],
        assertionMethod: [id],
        capabilityDelegation: [id],
        capabilityInvocation: [id],
      },
    }
  }

  return {
    didDocumentMetadata: {},
    didResolutionMetadata: {
      error: 'notFound',
      message: records.error?.message,
    },
    // eslint-disable-next-line unicorn/no-null
    didDocument: null,
  }
}

/** @type {import('did-resolver').ResolverRegistry} */
export const resolver = {
  fission: didFissionResolver,
}

/**
 * @param {string} url
 */
export function format(url) {
  const parsed = new URL(url)
  const _host = encodeURIComponent(parsed.host)

  return `did:fission:${_host}`
}
