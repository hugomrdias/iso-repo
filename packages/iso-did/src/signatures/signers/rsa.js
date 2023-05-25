/* eslint-disable unicorn/numeric-separators-style */
import { webcrypto } from 'iso-base/crypto'
import { u8 } from 'iso-base/utils'
import { DIDKey } from '../../key.js'
import { spki } from './spki.js'

/**
 * @typedef {import('./types.js').ISigner<CryptoKeyPair>} ISigner
 */

/**
 * @implements {ISigner}
 */
export class RSASigner {
  /** @type {Extract<import('../types.js').SignatureAlgorithm, "RS256">} */
  static alg = 'RS256'

  /** @type {Extract<import('../types.js').KeyType, "RSA">} */
  static type = 'RSA'

  // multicodec code for RSA private key
  static code = 0x1305

  /**
   * @param {Uint8Array} publicKey
   * @param {CryptoKeyPair} keypair
   */
  constructor(publicKey, keypair) {
    this.keypair = keypair
    this.publicKey = publicKey
    this.alg = RSASigner.alg
    this.type = RSASigner.type
    this.code = RSASigner.code
    this.did = DIDKey.fromPublicKey(RSASigner.type, this.publicKey)
  }

  static async generate() {
    const cryptoKeyPair = await webcrypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: { name: 'SHA-256' },
      },

      false,
      ['sign', 'verify']
    )

    const publicKey = await webcrypto.subtle.exportKey(
      'spki',
      cryptoKeyPair.publicKey
    )

    return new RSASigner(spki.decode(u8(publicKey)), cryptoKeyPair)
  }

  /**
   *
   * @param {import('../types.js').PrivateKeyRSAJwk} jwk
   */
  static async importJwk(jwk) {
    const privateKey = await webcrypto.subtle.importKey(
      'jwk',
      jwk,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    )
    const publicKeyJWK = await webcrypto.subtle.importKey(
      'jwk',
      { ...jwk, d: undefined },
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      true,
      ['verify']
    )

    const publicKey = await webcrypto.subtle.exportKey('spki', publicKeyJWK)

    return new RSASigner(spki.decode(u8(publicKey)), {
      privateKey,
      publicKey: publicKeyJWK,
    })
  }

  /**
   * @param {CryptoKeyPair} keypair
   */
  static async import(keypair) {
    const publicKey = await webcrypto.subtle.exportKey(
      'spki',
      keypair.publicKey
    )

    return new RSASigner(spki.decode(u8(publicKey)), keypair)
  }

  /**
   * @param {Uint8Array} message
   */
  async sign(message) {
    const buf = await webcrypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5', saltLength: 128 },
      this.keypair.privateKey,
      message
    )

    return u8(buf)
  }

  export() {
    return this.keypair
  }
}
