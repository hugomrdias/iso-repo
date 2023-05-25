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
 * @implements {ISigner}
 */
export class Ed25519Signer {
  /** @type {Extract<import('../types.js').SignatureAlgorithm, "EdDSA">} */
  static alg = 'EdDSA'

  /** @type {Extract<import('../types.js').KeyType, "Ed25519">} */
  static type = 'Ed25519'

  static code = 0x1300

  /**
   * @param {Uint8Array} publicKey
   * @param {Uint8Array} privateKey
   */
  constructor(publicKey, privateKey) {
    this.privateKey = privateKey
    this.publicKey = publicKey
    this.alg = Ed25519Signer.alg
    this.type = Ed25519Signer.type
    this.code = Ed25519Signer.code
    this.did = DIDKey.fromPublicKey(Ed25519Signer.type, this.publicKey)
  }

  /**
   * @param {Uint8Array} [bytes]
   */
  static async generate(bytes) {
    const privateKey = bytes || utils.randomPrivateKey()
    const publicKey = await getPublicKeyAsync(privateKey)
    return new Ed25519Signer(publicKey, privateKey)
  }

  /**
   * @param {string} encoded
   */
  static async import(encoded) {
    const privateKey = untag(Ed25519Signer.code, base64pad.decode(encoded))
    const publicKey = await getPublicKeyAsync(privateKey)

    return new Ed25519Signer(publicKey, privateKey)
  }

  /**
   * @param {Uint8Array} message
   */
  async sign(message) {
    return signAsync(message, this.privateKey)
  }

  export() {
    return base64pad.encode(tag(Ed25519Signer.code, this.privateKey))
  }
}
