/* eslint-disable unicorn/numeric-separators-style */
import { getPublicKeyAsync, signAsync, utils } from '@noble/ed25519'
import { webcrypto } from 'iso-base/crypto'
import { base64pad } from 'iso-base/rfc4648'
import { tag, untag } from 'iso-base/varint'
import { DIDKey } from 'iso-did/key'
import { didKeyOrVerifiableDID } from '../utils.js'

// @ts-ignore
if (!globalThis.crypto) globalThis.crypto = webcrypto

/**
 * @typedef {import('../types.js').ISigner<string>} ISigner
 */

/**
 *
 * @param {import('iso-did/types').VerifiableDID} did
 */
function checkDid(did) {
  if (did.type !== 'Ed25519') {
    throw new TypeError(`Unsupported key type ${did.type}`)
  }
  if (did.alg !== 'EdDSA') {
    throw new TypeError(`Unsupported algorithm ${did.alg}`)
  }
}

/**
 * EdDSA signer
 *
 * @implements {ISigner}
 */
export class EdDSASigner {
  /** @type {Extract<import('iso-did/types').SignatureAlgorithm, "EdDSA">} */
  static alg = 'EdDSA'

  /** @type {Extract<import('iso-did/types').KeyType, "Ed25519">} */
  static type = 'Ed25519'

  static code = 0x1300

  /** @type {Uint8Array} */
  #privateKey

  /**
   * @param {import('iso-did/types').VerifiableDID} did
   * @param {Uint8Array} privateKey
   */
  constructor(did, privateKey) {
    checkDid(did)
    this.did = did.did
    this.url = did.url
    this.type = did.type
    this.publicKey = did.publicKey
    this.alg = did.alg
    this.document = did.document
    this.#privateKey = privateKey
    this.didKey = did.didKey
  }

  /**
   * Generate a new signer
   *
   * @param {Uint8Array} [bytes]
   */
  static async generate(bytes) {
    const privateKey = bytes || utils.randomPrivateKey()
    const publicKey = await getPublicKeyAsync(privateKey)
    return new EdDSASigner(
      DIDKey.fromPublicKey('Ed25519', publicKey),
      privateKey
    )
  }

  /**
   * Import a signer from a encoded string
   *
   * @param {string} encoded
   * @param {import('iso-did/types').VerifiableDID} [did]
   */
  static async import(encoded, did) {
    const privateKey = untag(EdDSASigner.code, base64pad.decode(encoded))
    const publicKey = await getPublicKeyAsync(privateKey)

    return new EdDSASigner(
      didKeyOrVerifiableDID('Ed25519', publicKey, did),
      privateKey
    )
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    return signAsync(message, this.#privateKey)
  }

  /**
   * Export the signer as a encoded string
   */
  export() {
    return base64pad.encode(tag(EdDSASigner.code, this.#privateKey))
  }

  toString() {
    return this.url.didUrl
  }
}
