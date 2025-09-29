import * as EC from 'iso-base/ec-compression'
import { tag, varint } from 'iso-base/varint'
import { base58btc } from 'multiformats/bases/base58'
import { CODE_KEY_TYPE, KEY_TYPE_CODE } from './common.js'
import { DIDCore } from './core.js'

import * as T from './types.js'

export * from './common.js'

const DID_KEY_PREFIX = 'did:key:'

/**
 * Validate raw public key length
 *
 * @param {number} code
 * @param {Uint8Array} key
 */
export function validateRawPublicKeyLength(code, key) {
  switch (code) {
    case KEY_TYPE_CODE.secp256k1: {
      if (key.length !== 33) {
        throw new RangeError('Secp256k1 public keys must be 33 bytes.')
      }
      return key
    }
    case KEY_TYPE_CODE.Ed25519: {
      if (key.length !== 32) {
        throw new RangeError('ed25519 public keys must be 32 bytes.')
      }
      return key
    }
    case KEY_TYPE_CODE['P-256']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }

      if (EC.isCompressed(key) && key.length !== 33) {
        throw new RangeError('p256 public keys must be 33 bytes.')
      }

      return key
    }
    case KEY_TYPE_CODE['P-384']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }
      if (EC.isCompressed(key) && key.length !== 49) {
        throw new RangeError('p384 public keys must be 49 bytes.')
      }
      return key
    }
    case KEY_TYPE_CODE['P-521']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }
      if (EC.isCompressed(key) && key.length !== 67) {
        throw new RangeError('p521 public keys must be 67 bytes.')
      }
      return key
    }

    case KEY_TYPE_CODE.RSA: {
      if (key.length !== 270 && key.length !== 526) {
        throw new RangeError(
          'RSA public keys must be 270 bytes for 2048 bits or 526 bytes for 4096 bits.'
        )
      }
      return key
    }
    default: {
      throw new RangeError(
        `Unsupported DID encoding, unknown multicode 0x${code.toString(16)}.`
      )
    }
  }
}

/**
 * did:key Method
 *
 * @implements {T.VerifiableDID}
 */
export class DIDKey extends DIDCore {
  /**
   *
   * @param {T.DIDURLObject} did
   * @param {T.KeyType} type
   * @param {Uint8Array} key
   */
  constructor(did, type, key) {
    super(did)
    this.type = type
    this.publicKey = key
    this.code = KEY_TYPE_CODE[type]
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

    if (did.method === 'key') {
      const encodedKey = base58btc.decode(did.id)
      const [code, size] = varint.decode(encodedKey)
      const key = validateRawPublicKeyLength(code, encodedKey.slice(size))

      return new DIDKey(
        did,
        CODE_KEY_TYPE[/** @type {T.PublicKeyCode} */ (code)],
        key
      )
    }
    throw new TypeError(`Invalid DID "${did}", method must be 'key'`)
  }

  /**
   * Create a DIDKey from a public key bytes
   *
   * @param {T.KeyType} type
   * @param {Uint8Array} key
   */
  static fromPublicKey(type, key) {
    const code = KEY_TYPE_CODE[type]
    if (!code) {
      throw new TypeError(`Unsupported key type "${type}"`)
    }

    const keyBytes = validateRawPublicKeyLength(code, key)
    const id = base58btc.encode(tag(code, keyBytes))

    return new DIDKey(
      {
        did: /** @type {T.DID} */ (`${DID_KEY_PREFIX}${id}`),
        didUrl: /** @type {T.DIDURL} */ (`${DID_KEY_PREFIX}${id}`),
        id,
        method: 'key',
      },
      type,
      keyBytes
    )
  }

  /**
   *
   * @returns {T.DIDDocument}
   */
  get document() {
    const id = /** @type {T.DIDURL} */ (`${this.did}#${this.id}`)
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: this.did,
      verificationMethod: [
        {
          id,
          type: 'MultiKey',
          controller: this.did,
          publicKeyMultibase: this.id,
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
async function didKeyResolver(did, _parsedDid) {
  const didKey = DIDKey.fromString(did)
  return {
    didDocumentMetadata: {},
    didResolutionMetadata: {
      contentType: 'application/did+ld+json',
    },
    didDocument: didKey.document,
  }
}

/** @type {import('did-resolver').ResolverRegistry} */
export const resolver = {
  key: didKeyResolver,
}
