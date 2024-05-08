import { equals, u8 } from 'iso-base/utils'
import { DIDKey } from 'iso-did/key'

/**
 * Create web crypto params for ECDSA.
 *
 * @param {import("iso-did/types").SignatureAlgorithm} alg
 * @returns {{name: 'ECDSA', namedCurve: 'P-256' | 'P-384' | 'P-521', hash: 'SHA-256' | 'SHA-384' | 'SHA-512'}}
 */
export function createEcdsaParams(alg) {
  switch (alg) {
    case 'ES256': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-256',
        hash: 'SHA-256',
      }
    }
    case 'ES384': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-384',
        hash: 'SHA-384',
      }
    }
    case 'ES512': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-521',
        hash: 'SHA-512',
      }
    }

    default: {
      throw new TypeError(`Unsupported algorithm ${alg}`)
    }
  }
}

/**
 *
 * @param {import('iso-did/types').KeyType} type
 * @param {BufferSource} publicKey
 * @param {import('iso-did/types').VerifiableDID} [did]
 */
export function didKeyOrVerifiableDID(type, publicKey, did) {
  /** @type {import('iso-did/types').VerifiableDID} */
  let _did = DIDKey.fromPublicKey(type, u8(publicKey))
  if (did) {
    if (!equals(did.publicKey, _did.publicKey)) {
      throw new Error('Public key mismatch')
    }

    if (did.alg !== _did.alg) {
      throw new Error('Algorithm mismatch')
    }

    if (did.type !== _did.type) {
      throw new Error('Key type mismatch')
    }
    _did = did
  }

  return _did
}
