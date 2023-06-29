/* eslint-disable complexity */
import * as EC from 'iso-base/ec-compression'
import { u8, equals, concat } from 'iso-base/utils'
import { tag, varint } from 'iso-base/varint'
import { base58btc } from 'multiformats/bases/base58'
import { CODE_KEY_TYPE, KEY_TYPE_CODE, keyTypeToAlg } from './common.js'
import { DIDCore } from './core.js'

export * from './common.js'

const DID_KEY_PREFIX = `did:key:`

/**
 * Validate raw public key length
 *
 * @param {number} code
 * @param {Uint8Array} key
 */
function validateRawPublicKeyLength(code, key) {
  switch (code) {
    case KEY_TYPE_CODE.secp256k1: {
      if (key.length !== 33) {
        throw new RangeError(`Secp256k1 public keys must be 33 bytes.`)
      }
      return key
    }
    case KEY_TYPE_CODE.Ed25519: {
      if (key.length !== 32) {
        throw new RangeError(`ed25519 public keys must be 32 bytes.`)
      }
      return key
    }
    case KEY_TYPE_CODE['P-256']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }

      if (EC.isCompressed(key) && key.length !== 33) {
        throw new RangeError(`p256 public keys must be 33 bytes.`)
      }

      return key
    }
    case KEY_TYPE_CODE['P-384']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }
      if (EC.isCompressed(key) && key.length !== 49) {
        throw new RangeError(`p384 public keys must be 49 bytes.`)
      }
      return key
    }
    case KEY_TYPE_CODE['P-521']: {
      if (EC.isUncompressed(key)) {
        key = EC.compress(key)
      }
      if (EC.isCompressed(key) && key.length !== 67) {
        throw new RangeError(`p521 public keys must be 67 bytes.`)
      }
      return key
    }

    case KEY_TYPE_CODE.RSA: {
      if (key.length !== 270 && key.length !== 526) {
        throw new RangeError(
          `RSA public keys must be 270 bytes for 2048 bits or 526 bytes for 4096 bits.`
        )
      }
      return key
    }

    case KEY_TYPE_CODE.RSA_OLD: {
      // if (key.length !== 270 && key.length !== 526) {
      //   throw new RangeError(
      //     `RSA public keys must be 270 bytes for 2048 bits or 526 bytes for 4096 bits.`
      //   )
      // }
      return key
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
   * @param {import('./types').KeyType} type
   * @param {Uint8Array} key
   */
  constructor(did, type, key) {
    super(did)
    this.type = type
    this.publicKey = key
    this.code = KEY_TYPE_CODE[type]
    this.alg = keyTypeToAlg(type)
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
      let code
      let size
      let key

      // fission old rsa key
      if (
        equals(encodedKey.subarray(0, 3), new Uint8Array([0x00, 0xf5, 0x02]))
      ) {
        code = KEY_TYPE_CODE.RSA_OLD
        size = 3
        key = validateRawPublicKeyLength(code, encodedKey.slice(size))
      } else {
        ;[code, size] = varint.decode(encodedKey)
        key = validateRawPublicKeyLength(code, encodedKey.slice(size))
      }

      return new DIDKey(
        did,
        CODE_KEY_TYPE[/** @type {import('./types').PublicKeyCode} */ (code)],
        key
      )
    } else {
      throw new TypeError(`Invalid DID "${did}", method must be 'key'`)
    }
  }

  /**
   * Create a DIDKey from a public key bytes
   *
   * @param {import('./types').KeyType} type
   * @param {BufferSource} key
   */
  static fromPublicKey(type, key) {
    const code = KEY_TYPE_CODE[type]
    if (!code) {
      throw new TypeError(`Unsupported key type "${type}"`)
    }

    const keyBytes = validateRawPublicKeyLength(code, u8(key))
    const id =
      type === 'RSA_OLD'
        ? base58btc.encode(concat([[0x00, 0xf5, 0x02], keyBytes]))
        : base58btc.encode(tag(code, keyBytes))

    return new DIDKey(
      {
        did: `${DID_KEY_PREFIX}${id}`,
        didUrl: `${DID_KEY_PREFIX}${id}`,
        id,
        method: 'key',
      },
      type,
      keyBytes
    )
  }
}
