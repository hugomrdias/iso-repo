import { getPublicKey, signAsync, utils } from '@noble/secp256k1'
import { base64pad, base64url } from 'iso-base/rfc4648'
import { tag, untag } from 'iso-base/varint'
import { DID } from 'iso-did'
import { DIDKey } from 'iso-did/key'
import { didKeyOrVerifiableDID } from '../utils.js'

/**
 * @typedef {import('../types.js').ISigner<string>} ISigner
 */

/**
 * @param {import('iso-did/types').VerifiableDID} did
 */
function checkDid(did) {
  if (did.verifiableDid.type !== 'secp256k1') {
    throw new TypeError(`Unsupported key type ${did.verifiableDid.type}`)
  }
}

/**
 * ES256K signer (secp256k1 and SHA-256)
 *
 * @implements {ISigner}
 */
export class ES256KSigner extends DID {
  /**
   * Multibase code for secp256k1 private key
   * @see https://github.com/multiformats/multicodec/blob/3bc7f4c20afe28e10d9d539e2a565578de6dd71c/table.csv#L182
   * @type {number}
   */
  static code = 0x1301

  /** @type {import('../types.js').SignatureType} */
  signatureType

  /** @type {Uint8Array} */
  #privateKey

  /**
   *
   * @param {import('iso-did/types').VerifiableDID} did
   * @param {Uint8Array} privateKey
   */
  constructor(did, privateKey) {
    checkDid(did)
    super(did)
    this.#privateKey = privateKey
    this.signatureType = 'ES256K'
  }

  /**
   * Generate a new signer
   *
   * @param {Uint8Array<ArrayBuffer>} [bytes]
   */
  static generate(bytes) {
    const privateKey = bytes || utils.randomSecretKey()
    const publicKey = getPublicKey(privateKey)

    return new ES256KSigner(
      DIDKey.fromPublicKey(
        'secp256k1',
        /** @type {Uint8Array<ArrayBuffer>} */ (publicKey)
      ),
      privateKey
    )
  }

  /**
   * Import a signer from a JWK
   *
   * @param {import('iso-did/types').ECJWKPrivate} jwk
   * @param {import('iso-did/types').VerifiableDID} [did] - Optional DID to verify the JWK
   */
  static importJwk(jwk, did) {
    const privateKey = base64url.decode(jwk.d)
    const publicKey = getPublicKey(privateKey)

    return new ES256KSigner(
      didKeyOrVerifiableDID(
        'secp256k1',
        /** @type {Uint8Array<ArrayBuffer>} */ (publicKey),
        did
      ),
      privateKey
    )
  }

  /**
   * Import a signer from a encoded string
   *
   * @param {string} encoded
   * @param {import('iso-did/types').VerifiableDID} [did]
   */
  static import(encoded, did) {
    const privateKey = untag(ES256KSigner.code, base64pad.decode(encoded))
    const publicKey = getPublicKey(privateKey)

    return new ES256KSigner(
      didKeyOrVerifiableDID(
        'secp256k1',
        /** @type {Uint8Array<ArrayBuffer>} */ (publicKey),
        did
      ),
      privateKey
    )
  }

  /**
   * Sign a message
   *
   * @param {Uint8Array<ArrayBuffer>} message
   */
  async sign(message) {
    const sig = await signAsync(message, this.#privateKey)
    return /** @type {Uint8Array<ArrayBuffer>} */ (sig)
  }

  /**
   * Export the signer as a encoded string
   */
  export() {
    return base64pad.encode(tag(ES256KSigner.code, this.#privateKey))
  }

  toString() {
    return this.didObject.didUrl
  }
}
