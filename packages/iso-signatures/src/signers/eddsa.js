/* eslint-disable unicorn/numeric-separators-style */
import { getPublicKeyAsync, signAsync, utils } from '@noble/ed25519'
import { webcrypto } from 'iso-base/crypto'
import { base64pad, base64url } from 'iso-base/rfc4648'
import { tag, untag } from 'iso-base/varint'
import { DID } from 'iso-did'
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
  if (did.verifiableDid.type !== 'Ed25519') {
    throw new TypeError(`Unsupported key type ${did.verifiableDid.type}`)
  }
}

/**
 * EdDSA signer
 *
 * @implements {ISigner}
 */
export class EdDSASigner extends DID {
  /**
   * Multibase code for ed25519 private key
   * @see https://github.com/multiformats/multicodec/blob/3bc7f4c20afe28e10d9d539e2a565578de6dd71c/table.csv#L181
   * @type {number}
   */
  static code = 0x1300

  /** @type {Uint8Array} */
  #privateKey

  /** @type {import('../types.js').SignatureType} */
  signatureType

  /**
   * @param {import('iso-did/types').VerifiableDID} did
   * @param {Uint8Array} privateKey
   */
  constructor(did, privateKey) {
    checkDid(did)
    super(did)
    this.#privateKey = privateKey
    this.signatureType = 'Ed25519'
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
   * Import a signer from a JWK
   *
   * @param {import('iso-did/types').OKPJWKPrivate} jwk
   * @param {import('iso-did/types').VerifiableDID} [did] - Optional DID to verify the JWK
   */
  static importJwk(jwk, did) {
    const privateKey = base64url.decode(jwk.d)
    const publicKey = base64url.decode(jwk.x)

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
  sign(message) {
    return signAsync(message, this.#privateKey)
  }

  /**
   * Export the signer as a encoded string
   */
  export() {
    return base64pad.encode(tag(EdDSASigner.code, this.#privateKey))
  }

  toString() {
    return this.didObject.didUrl
  }
}
