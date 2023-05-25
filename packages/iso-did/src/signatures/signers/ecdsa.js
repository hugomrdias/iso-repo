/* eslint-disable unicorn/numeric-separators-style */
import { webcrypto } from 'iso-base/crypto'
import { u8 } from 'iso-base/utils'
import { DIDKey } from '../../key.js'
import { createEcdsaParams, keyTypeToAlg } from '../common.js'

/**
 * @typedef {import('./types.js').ISigner<CryptoKeyPair>} ISigner
 */

/**
 * @implements {ISigner}
 */
export class ECDSASigner {
  /**
   * @param {import('../types.js').SignatureAlgorithm} alg
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
   * @param {import('../types.js').SignatureAlgorithm} alg
   */
  static async generate(alg) {
    const params = createEcdsaParams(alg)
    const cryptoKeyPair = await webcrypto.subtle.generateKey(
      {
        name: params.name,
        namedCurve: params.namedCurve,
      },
      false,
      ['sign', 'verify']
    )

    const publicKey = await webcrypto.subtle.exportKey(
      'raw',
      cryptoKeyPair.publicKey
    )

    return new ECDSASigner(alg, u8(publicKey), cryptoKeyPair)
  }

  /**
   *
   * @param {import('../types.js').PrivateKeyJwk} jwk
   */
  static async importJwk(jwk) {
    const alg = keyTypeToAlg(jwk.crv)
    const params = createEcdsaParams(alg)
    const privateKey = await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: params.name,
        namedCurve: params.namedCurve,
      },
      false,
      ['sign']
    )
    const publicKeyJWK = await webcrypto.subtle.importKey(
      'jwk',
      { ...jwk, d: undefined },
      {
        name: params.name,
        namedCurve: params.namedCurve,
      },
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
   * @param {CryptoKeyPair} key
   */
  static async import(key) {
    const publicKey = await webcrypto.subtle.exportKey('raw', key.publicKey)

    /** @type {'ES256' | 'ES384' | 'ES512' } */
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
   * @param {Uint8Array} message
   */
  async sign(message) {
    const buf = await webcrypto.subtle.sign(
      { name: this.params.name, hash: { name: this.params.hash } },
      this.keypair.privateKey,
      message
    )

    return u8(buf)
  }

  export() {
    return this.keypair
  }
}
