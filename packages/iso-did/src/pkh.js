import { DIDCore } from './core.js'
import * as T from './types.js'

export * from './common.js'

const DID_PKH_PREFIX = 'did:pkh:'

/**
 * @param {string} caip
 */
function parseCaip(caip) {
  const [namespace, chainId, address] = caip.split(':')
  if (namespace !== 'eip155') {
    throw new TypeError(`Unsupported namespace "${namespace}"`)
  }
  return { namespace, chainId, address }
}

/**
 * did:pkh Method
 *
 * @see https://github.com/w3c-ccg/did-pkh/blob/main/did-pkh-method-draft.md
 *
 * @implements {T.VerifiableDID}
 */
export class DIDPkh extends DIDCore {
  /**
   *
   * @param {T.DIDURLObject} did
   */
  constructor(did) {
    super(did)

    const { namespace, chainId, address } = parseCaip(did.id)
    this.namespace = namespace
    this.chainId = chainId
    this.address = /** @type {`0x${string}`} */ (address)
    /** @type {T.KeyType} */
    this.type = 'secp256k1'
    this.publicKey = new Uint8Array()
    this.didObject = did
    this.verifiableDid = this
  }

  /**
   * Create a DIDKey from a DID string
   *
   * @param {string} didString
   */
  static fromString(didString) {
    const did = DIDCore.fromString(didString)

    if (did.method === 'pkh') {
      return new DIDPkh(did)
    }
    throw new TypeError(`Invalid DID "${did}", method must be 'key'`)
  }

  /**
   * Create a DIDPkh from an address
   *
   * @param {`0x${string}`} address
   * @param {number | `0x${string}`} [chainId]
   * @param {string} namespace
   */
  static fromAddress(address, chainId = 1, namespace = 'eip155') {
    if (typeof chainId === 'string') {
      chainId = Number.parseInt(chainId, 16)
    }
    const caip = `${namespace}:${chainId}:${address}`
    return new DIDPkh(DIDCore.fromString(`${DID_PKH_PREFIX}${caip}`))
  }

  /**
   *
   * @returns {T.DIDDocument}
   */
  get document() {
    const id = /** @type {T.DIDURL} */ (`${this.did}#blockchainAccountId`)
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security#blockchainAccountId',
        'https://identity.foundation/EcdsaSecp256k1RecoverySignature2020#EcdsaSecp256k1RecoveryMethod2020',
      ],
      id: this.did,
      verificationMethod: [
        {
          id,
          type: 'EcdsaSecp256k1RecoveryMethod2020',
          controller: this.did,
          blockchainAccountId: this.id,
        },
      ],
      authentication: [id],
      assertionMethod: [id],
      capabilityDelegation: [id],
      capabilityInvocation: [id],
    }
  }
}

/** @type {import('did-resolver').DIDResolver} */
// biome-ignore lint/suspicious/useAwait: needs to be async
async function didPkhResolver(did, _parsedDid) {
  const didPkh = DIDPkh.fromString(did)
  return {
    didDocumentMetadata: {},
    didResolutionMetadata: {
      contentType: 'application/did+ld+json',
    },
    didDocument: didPkh.document,
  }
}

/** @type {import('did-resolver').ResolverRegistry} */
export const resolver = {
  pkh: didPkhResolver,
}
