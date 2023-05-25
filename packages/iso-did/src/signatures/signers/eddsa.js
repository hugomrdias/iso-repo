/* eslint-disable unicorn/numeric-separators-style */
import { getPublicKeyAsync, signAsync, utils } from '@noble/ed25519'
import { webcrypto } from 'iso-base/crypto'
import { base64pad } from 'iso-base/rfc4648'
import { tag, untag } from 'iso-base/varint'
import { DIDKey } from '../../key.js'

// @ts-ignore
if (!globalThis.crypto) globalThis.crypto = webcrypto

/**
 * @typedef {import('./types.js').ISigner<string>} ISigner
 */

/**
 * EdDSA signer
 *
 * @implements {ISigner}
 */
export class EdDSASigner {
  /** @type {Extract<import('../../types.js').SignatureAlgorithm, "EdDSA">} */
  static alg = 'EdDSA'

  /** @type {Extract<import('../../types.js').KeyType, "Ed25519">} */
  static type = 'Ed25519'

  static code = 0x1300

  /**
   * @param {Uint8Array} publicKey
   * @param {Uint8Array} privateKey
   */
  constructor(publicKey, privateKey) {
    this.privateKey = privateKey
    this.publicKey = publicKey
    this.alg = EdDSASigner.alg
    this.type = EdDSASigner.type
    this.code = EdDSASigner.code
    this.did = DIDKey.fromPublicKey(EdDSASigner.type, this.publicKey)
  }

  /**
   * Generate a new signer
   *
   * @param {Uint8Array} [bytes]
   */
  static async generate(bytes) {
    const privateKey = bytes || utils.randomPrivateKey()
    const publicKey = await getPublicKeyAsync(privateKey)
    return new EdDSASigner(publicKey, privateKey)
  }

  /**
   * Import a signer from a encoded string
   *
   * @param {string} encoded
   */
  static async import(encoded) {
    const privateKey = untag(EdDSASigner.code, base64pad.decode(encoded))
    const publicKey = await getPublicKeyAsync(privateKey)

    return new EdDSASigner(publicKey, privateKey)
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array} message
   */
  async sign(message) {
    return signAsync(message, this.privateKey)
  }

  /**
   * Export the signer as a encoded string
   */
  export() {
    return base64pad.encode(tag(EdDSASigner.code, this.privateKey))
  }
}
