import { webcrypto } from 'iso-base/crypto'
import { u8 } from 'iso-base/utils'
import { DID } from 'iso-did'
import { DIDKey } from 'iso-did/key'
import { didKeyOrVerifiableDID } from '../utils.js'

/**
 * @typedef {import('../types.js').ISigner<CryptoKeyPair>} ISigner
 * @typedef {Extract<import('iso-did/types').KeyType, 'P-256' | 'P-384' | 'P-521'>} Curves
 * @typedef {Extract<import('../types.js').SignatureType, 'ES256' | 'ES384' | 'ES512'>} SignatureTypes
 */

/**
 *
 * @param {import('iso-did/types').KeyType} type
 * @returns
 */
function checkCurve(type) {
  if (['P-256', 'P-384', 'P-521'].includes(type)) {
    return /** @type {Curves} */ (type)
  }
  throw new TypeError(`Unsupported algorithm ${type}`)
}

/**
 * @param {Curves} type
 */
function curveToSignatureType(type) {
  switch (type) {
    case 'P-256':
      return 'ES256'
    case 'P-384':
      return 'ES384'
    case 'P-521':
      return 'ES512'
    default:
      throw new TypeError(`Unsupported key type ${type}`)
  }
}

/**
 * Create web crypto params for ECDSA.
 *
 * @param {Curves} curve
 * @returns {{name: 'ECDSA', namedCurve: 'P-256' | 'P-384' | 'P-521', hash: 'SHA-256' | 'SHA-384' | 'SHA-512'}}
 */
export function createEcdsaParams(curve) {
  switch (curve) {
    case 'P-256': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-256',
        hash: 'SHA-256',
      }
    }
    case 'P-384': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-384',
        hash: 'SHA-384',
      }
    }
    case 'P-521': {
      return {
        name: 'ECDSA',
        namedCurve: 'P-521',
        hash: 'SHA-512',
      }
    }

    default: {
      throw new TypeError(`Unsupported algorithm ${curve}`)
    }
  }
}

/**
 * ECDSA signer for ES256, ES384, and ES512 using WebCrypto
 *
 * @implements {ISigner}
 */
export class ECDSASigner extends DID {
  /** @type {ReturnType<createEcdsaParams>} */
  #params

  /** @type {CryptoKeyPair} */
  #keypair

  /** @type {import('../types.js').SignatureType} */
  signatureType
  /**
   * @param {import('iso-did/types').VerifiableDID} did
   * @param {CryptoKeyPair} keypair
   */
  constructor(did, keypair) {
    super(did)
    this.curve = checkCurve(did.verifiableDid.type)
    this.signatureType = curveToSignatureType(this.curve)
    this.#params = createEcdsaParams(this.curve)
    this.#keypair = keypair
  }

  /**
   * Generate a new signer
   *
   * @param {Curves} curve
   */
  static async generate(curve) {
    const params = createEcdsaParams(curve)
    const cryptoKeyPair = await webcrypto.subtle.generateKey(params, false, [
      'sign',
      'verify',
    ])

    const publicKey = await webcrypto.subtle.exportKey(
      'raw',
      cryptoKeyPair.publicKey
    )

    return new ECDSASigner(
      DIDKey.fromPublicKey(curve, u8(publicKey)),
      cryptoKeyPair
    )
  }

  /**
   * Import a signer from a JWK
   *
   * @param {import('iso-did/types').ECJWKPrivate} jwk
   * @param {import('iso-did/types').VerifiableDID} [did]
   */
  static async importJwk(jwk, did) {
    const curve = checkCurve(jwk.crv)
    const params = createEcdsaParams(curve)
    const type = jwk.crv
    const privateKey = await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      params,
      false,
      ['sign']
    )
    const publicKeyJWK = await webcrypto.subtle.importKey(
      'jwk',
      { ...jwk, d: undefined },
      params,
      true,
      ['verify']
    )

    const publicKey = await webcrypto.subtle.exportKey('raw', publicKeyJWK)

    return new ECDSASigner(didKeyOrVerifiableDID(type, u8(publicKey), did), {
      privateKey,
      publicKey: publicKeyJWK,
    })
  }

  /**
   * Import a signer from a CryptoKeyPair
   *
   * @param {CryptoKeyPair} key
   * @param {import('iso-did/types').VerifiableDID} [did]
   */
  static async import(key, did) {
    const publicKey = await webcrypto.subtle.exportKey('raw', key.publicKey)

    /** @type { Curves } */
    let curve
    switch (publicKey.byteLength) {
      case 65: {
        curve = 'P-256'
        break
      }
      case 97: {
        curve = 'P-384'
        break
      }
      case 133: {
        curve = 'P-521'
        break
      }

      default: {
        throw new Error('Unsupported key type')
      }
    }

    return new ECDSASigner(
      didKeyOrVerifiableDID(curve, u8(publicKey), did),
      key
    )
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    const buf = await webcrypto.subtle.sign(
      this.#params,
      this.#keypair.privateKey,
      /** @type {BufferSource} */ (message)
    )

    return u8(buf)
  }

  /**
   * Export the signer as a CryptoKeyPair
   *
   * @returns {CryptoKeyPair}
   */
  export() {
    return this.#keypair
  }

  toString() {
    return this.didObject.didUrl
  }
}
