import { base58btc } from 'multiformats/bases/base58'
import { varint } from 'multiformats'
import { DIDCore } from './core.js'
import { u8 } from 'iso-base/utils'

/* eslint-disable unicorn/numeric-separators-style */
const TYPE_CODE = /** @type {const} */ ({
  ED25519: 0xed,
  RSA: 0x1205,
  P256: 0x1200,
  P384: 0x1201,
  P521: 0x1202,
  SECP256K1: 0xe7,
})

const CODE_TYPE = /** @type {const} */ ({
  0xed: 'ED25519',
  0x1205: 'RSA',
  0x1200: 'P256',
  0x1201: 'P384',
  0x1202: 'P521',
  0xe7: 'SECP256K1',
})

/**
 * @typedef {typeof TYPE_CODE} CodecMap
 * @typedef {CodecMap[keyof CodecMap]} Code
 * @typedef {keyof CodecMap} PublicKeyType
 */

const DID_KEY_PREFIX = `did:key:`

/**
 * Validate raw public key length
 *
 * @param {number} code
 * @param {Uint8Array} key
 */
function validateRawPublicKeyLength(code, key) {
  switch (code) {
    case TYPE_CODE.SECP256K1: {
      if (key.length !== 33) {
        throw new RangeError(`Secp256k1 public keys must be 33 bytes.`)
      }
      return
    }
    case TYPE_CODE.ED25519: {
      if (key.length !== 32) {
        throw new RangeError(`ed25519 public keys must be 32 bytes.`)
      }
      return
    }
    case TYPE_CODE.P256: {
      if (key.length !== 33) {
        throw new RangeError(`p256 public keys must be 33 bytes.`)
      }
      return
    }
    case TYPE_CODE.P384: {
      if (key.length !== 49) {
        throw new RangeError(`p384 public keys must be 49 bytes.`)
      }
      return
    }
    case TYPE_CODE.P521: {
      if (key.length !== 67) {
        throw new RangeError(`p521 public keys must be 67 bytes.`)
      }
      return
    }

    case TYPE_CODE.RSA: {
      if (key.length !== 270 && key.length !== 526) {
        throw new RangeError(
          `RSA public keys must be 270 bytes for 2048 bits or 526 bytes for 4096 bits.`
        )
      }
      return
    }
    default: {
      throw new RangeError(
        `Unsupported DID encoding, unknown multicode 0x${code.toString(16)}.`
      )
    }
  }
}

/**
 * did:key Method
 */
export class DIDKey extends DIDCore {
  /**
   *
   * @param {import('./types').DID} did
   * @param {Code} code
   * @param {Uint8Array} key
   * @param {PublicKeyType} type
   */
  constructor(did, code, key, type) {
    super(did)
    this.code = code
    this.key = key
    this.type = type
  }

  /**
   * Create a DIDKey from a DID string
   *
   * @param {string} didString
   */
  static fromString(didString) {
    const did = DIDCore.fromString(didString)

    if (did.method === 'key') {
      const encodedKey = base58btc.decode(did.id)
      const [code, size] = /** @type {[Code, number]} */ (
        varint.decode(encodedKey)
      )
      const key = encodedKey.slice(size)

      validateRawPublicKeyLength(code, key)

      return new DIDKey(did, code, key, CODE_TYPE[code])
    } else {
      throw new TypeError(`Invalid DID "${did}", method must be 'key'`)
    }
  }

  /**
   * Create a DIDKey from a public key bytes
   *
   * @param {PublicKeyType} type
   * @param {BufferSource} key
   */
  static fromPublicKey(type, key) {
    const keyBytes = u8(key)
    const code = TYPE_CODE[type]
    if (!code) {
      throw new TypeError(`Unsupported key type "${type}"`)
    }

    const codeLenth = varint.encodingLength(code)
    const codedBytes = new Uint8Array(codeLenth + keyBytes.length)
    varint.encodeTo(code, codedBytes)
    codedBytes.set(keyBytes, codeLenth)

    return new DIDKey(
      {
        did: `${DID_KEY_PREFIX}${base58btc.encode(codedBytes)}`,
        didUrl: `${DID_KEY_PREFIX}${base58btc.encode(codedBytes)}`,
        id: `${base58btc.encode(codedBytes)}`,
        method: 'key',
      },
      code,
      keyBytes,
      type
    )
  }
}
