import { webcrypto } from 'iso-base/crypto'
import { u8 } from 'iso-base/utils'
import { DIDKey, algToKeyType, keyTypeToAlg } from 'iso-did/key'
import { createEcdsaParams, didKeyOrVerifiableDID } from '../utils.js'

/**
 * @typedef {import('../types.js').ISigner<CryptoKeyPair>} ISigner
 * @typedef {Extract<import('iso-did/types').SignatureAlgorithm, 'ES256' | 'ES384' | 'ES512'>} ECDSAAlg
 */

/**
 * @param {string} alg
 */
function asECDSAAlg(alg) {
  if (['ES256', 'ES384', 'ES512'].includes(alg)) {
    return /** @type {ECDSAAlg} */ (alg)
  }
  throw new TypeError(`Unsupported algorithm ${alg}`)
}

/**
 * ECDSA signer
 *
 * @implements {ISigner}
 */
export class ECDSASigner {
  /** @type {ReturnType<createEcdsaParams>} */
  #params

  /** @type {CryptoKeyPair} */
  #keypair
  /**
   * @param {import('iso-did/types').VerifiableDID} did
   * @param {CryptoKeyPair} keypair
   */
  constructor(did, keypair) {
    this.did = did.did
    this.url = did.url
    this.type = did.type
    this.publicKey = did.publicKey
    this.alg = asECDSAAlg(did.alg)
    this.document = did.document
    this.#params = createEcdsaParams(this.alg)
    this.#keypair = keypair
    this.didKey = did.didKey
  }

  /**
   * Generate a new signer
   *
   * @param {ECDSAAlg} alg
   */
  static async generate(alg) {
    const params = createEcdsaParams(alg)
    const cryptoKeyPair = await webcrypto.subtle.generateKey(params, false, [
      'sign',
      'verify',
    ])

    const publicKey = await webcrypto.subtle.exportKey(
      'raw',
      cryptoKeyPair.publicKey
    )

    return new ECDSASigner(
      DIDKey.fromPublicKey(algToKeyType(alg), u8(publicKey)),
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
    const alg = asECDSAAlg(keyTypeToAlg(jwk.crv))
    const params = createEcdsaParams(alg)
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

    return new ECDSASigner(didKeyOrVerifiableDID(type, publicKey, did), {
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

    /** @type { ECDSAAlg } */
    let alg
    switch (publicKey.byteLength) {
      case 65: {
        alg = 'ES256'
        break
      }
      case 97: {
        alg = 'ES384'
        break
      }
      case 133: {
        alg = 'ES512'
        break
      }

      default: {
        throw new Error('Unsupported key type')
      }
    }

    return new ECDSASigner(
      didKeyOrVerifiableDID(algToKeyType(alg), publicKey, did),
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
      message
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
    return this.url.didUrl
  }
}
