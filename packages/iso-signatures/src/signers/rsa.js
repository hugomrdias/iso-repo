/* eslint-disable unicorn/numeric-separators-style */
import { webcrypto } from 'iso-base/crypto'
import { u8 } from 'iso-base/utils'
import { DIDKey } from 'iso-did/key'
import { spki } from '../spki.js'
import { didKeyOrVerifiableDID } from '../utils.js'

/**
 * @typedef {import('../types.js').ISigner<CryptoKeyPair>} ISigner
 */

/**
 *
 * @param {import('iso-did/types').VerifiableDID} did
 */
function checkDid(did) {
  if (did.type !== RSASigner.type) {
    throw new TypeError(`Unsupported key type ${did.type}`)
  }
  if (did.alg !== RSASigner.alg) {
    throw new TypeError(`Unsupported algorithm ${did.alg}`)
  }
}

/**
 * RSA signer
 *
 * @implements {ISigner}
 */
export class RSASigner {
  /** @type {Extract<import('iso-did/types').SignatureAlgorithm, "RS256">} */
  static alg = 'RS256'

  /** @type {Extract<import('iso-did/types').KeyType, "RSA">} */
  static type = 'RSA'

  // multicodec code for RSA private key
  static code = 0x1305

  /** @type {CryptoKeyPair} */
  #keypair

  /**
   * @param {import('iso-did/types').VerifiableDID} did
   * @param {CryptoKeyPair} keypair
   */
  constructor(did, keypair) {
    checkDid(did)
    this.did = did.did
    this.url = did.url
    this.type = did.type
    this.publicKey = did.publicKey
    this.alg = did.alg
    this.document = did.document
    this.#keypair = keypair
    this.didKey = DIDKey.fromPublicKey(this.type, this.publicKey).url.did
  }

  /**
   * Generate a new signer
   */
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
    return new RSASigner(
      DIDKey.fromPublicKey('RSA', spki.decode(u8(publicKey))),
      cryptoKeyPair
    )
  }

  /**
   * Import a signer from a JWK
   *
   * @param {import('iso-did/types').RSAJWKPrivate} jwk
   * @param {import('iso-did/types').VerifiableDID} [did]
   */
  static async importJwk(jwk, did) {
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
    const decodedPublicKey = spki.decode(u8(publicKey))

    return new RSASigner(didKeyOrVerifiableDID('RSA', decodedPublicKey, did), {
      privateKey,
      publicKey: publicKeyJWK,
    })
  }

  /**
   * Import a signer from a keypair
   *
   * @param {CryptoKeyPair} keypair
   * @param {import('iso-did/types').VerifiableDID} [did]
   */
  static async import(keypair, did) {
    const publicKey = await webcrypto.subtle.exportKey(
      'spki',
      keypair.publicKey
    )

    const decodedPublicKey = spki.decode(u8(publicKey))

    return new RSASigner(
      didKeyOrVerifiableDID('RSA', decodedPublicKey, did),
      keypair
    )
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    const buf = await webcrypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5', saltLength: 128 },
      this.#keypair.privateKey,
      message
    )

    return u8(buf)
  }

  /**
   * Export the signer as a crypto key pair
   */
  export() {
    return this.#keypair
  }

  toString() {
    return this.url.didUrl
  }
}
