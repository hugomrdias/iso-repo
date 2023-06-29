/* eslint-disable unicorn/numeric-separators-style */
import { webcrypto } from 'iso-base/crypto'
import { u8 } from 'iso-base/utils'
import { DIDKey, keyTypeToAlg } from 'iso-did/key'
import { createEcdsaParams } from '../utils.js'

/**
 * @typedef {import('../types.js').ISigner<CryptoKeyPair>} ISigner
 * @typedef {Extract<import('iso-did/types').SignatureAlgorithm, 'ES256' | 'ES384' | 'ES512'>} ECDSAAlg
 */

/**
 * @param {string} alg
 */
function asECDSAAlg(alg) {
  if (alg.startsWith('ES')) {
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
  /**
   * @param {ECDSAAlg} alg
   * @param {Uint8Array} publicKey
   * @param {CryptoKeyPair} keypair
   */
  constructor(alg, publicKey, keypair) {
    this.params = createEcdsaParams(alg)
    this.keypair = keypair
    this.publicKey = publicKey
    this.alg = alg
    this.type = this.params.namedCurve
    this.did = DIDKey.fromPublicKey(this.type, this.publicKey)
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

    return new ECDSASigner(alg, u8(publicKey), cryptoKeyPair)
  }

  /**
   * Import a signer from a JWK
   *
   * @param {import('../types.js').PrivateKeyJwk} jwk
   */
  static async importJwk(jwk) {
    const alg = asECDSAAlg(keyTypeToAlg(jwk.crv))
    const params = createEcdsaParams(alg)
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

    return new ECDSASigner(alg, u8(publicKey), {
      privateKey,
      publicKey: publicKeyJWK,
    })
  }

  /**
   * Import a signer from a CryptoKeyPair
   *
   * @param {CryptoKeyPair} key
   */
  static async import(key) {
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
    return new ECDSASigner(alg, u8(publicKey), key)
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    const buf = await webcrypto.subtle.sign(
      this.params,
      this.keypair.privateKey,
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
    return this.keypair
  }
}
