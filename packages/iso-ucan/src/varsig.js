import { IOBuffer } from 'iobuffer'
import { hex } from 'iso-base/rfc4648'
import { equals } from 'iso-base/utils'
import { varint } from 'iso-base/varint'

export const VARSIG = 0x34
export const VERSION = 0x01
export const EIP191_ENCODING = 0xe191

/**
 * @type {Record<number, import('./types.js').VarsigEncoding>}
 */
export const CODE_ENCODING = /** @types  {const} */ {
  0x5f: 'RAW',
  0x71: 'DAG-CBOR',
}

/**
 * @type {Record<number, string>}
 */
export const SIG_PREFIX = /** @type {const} */ ({
  0x12_05: 'RSA',
  0xed: 'EdDSA',
  0xec: 'ECDSA',
})

/**
 * Varint encoding for signature algorithms and encodings.
 *
 * @type {Record<'VARSIG' | 'VERSION' | import('./types.js').VarsigEncoding | import('./types.js').VarsigAlgorithm, number[]  >}
 */
const VARINT = {
  VARSIG: [52],
  VERSION: [1],

  RAW: [95],
  'DAG-CBOR': [113],

  /** Presets */
  // rsa(2b)+SHA2-256(1b)+256(1b)
  RS256: [133, 36, 18, 128, 2],
  // eddsa(2b)+edwards25519(2b)+SHA2-512(1b)
  Ed25519: [237, 1, 237, 1, 19],
  // ECDSA(2b) + p256(2b)   + SHA2-256(1b)
  ES256: [236, 1, 128, 36, 18],
  // ECDSA(2b) + p384(2b)   + SHA2-384(1b)
  ES384: [236, 1, 129, 36, 32],
  // ECDSA(2b) + p512(2b)   + SHA2-512(1b)
  ES512: [236, 1, 130, 36, 19],
  // ECDSA(2b) + secp256k1(2b)  + SHA2-256(1b)
  ES256K: [236, 1, 231, 1, 18],
  // ECDSA(2b) + secp256k1(2b) + keccak-256(1b) + eip191-encoding(3b)
  EIP191: [236, 1, 231, 1, 27, 145, 195, 3],
}

/**
 * @param {import('./types.js').VarsigOptions} options
 */
export function encode(options) {
  const enc = VARINT[options.enc]
  if (!enc) {
    throw new TypeError(`Unsupported encoding ${options.enc}`)
  }

  const alg = VARINT[options.alg]
  if (!alg) {
    throw new TypeError(`Unsupported algorithm ${options.alg}`)
  }

  return Uint8Array.from([...VARINT.VARSIG, ...VARINT.VERSION, ...alg, ...enc])
}

/**
 * @param {Uint8Array} bytes
 */
function getEncoding(bytes) {
  const [code] = varint.decode(bytes)
  const enc = CODE_ENCODING[code]
  if (!enc) {
    throw new TypeError(`Unsupported encoding 0x${code.toString(16)}`)
  }
  return enc
}

/**
 * @param {Uint8Array} bytes
 * @param {import('./types.js').VarsigAlgorithm[]} presets
 */
function getPreset(bytes, presets) {
  for (const preset of presets) {
    if (equals(bytes, Uint8Array.from(VARINT[preset]))) {
      return preset
    }
  }
  throw new TypeError(`Unsupported preset ${bytes}`)
}

/**
/**
 * Decode varsig header
 *
 * @param {Uint8Array<ArrayBuffer>} buf
 * @returns {import('./types.js').DecodeOutput}
 */
export function decode(buf) {
  const bytes = new IOBuffer(buf)
  const varsig = /** @type {Uint8Array<ArrayBuffer>} */ (bytes.readBytes(1))
  if (varsig[0] !== VARINT.VARSIG[0]) {
    throw new TypeError(
      `Invalid varsig sigil expected 0x${VARSIG.toString(16)} got 0x${hex.encode(varsig)}`
    )
  }

  const version = /** @type {Uint8Array<ArrayBuffer>} */ (bytes.readBytes(1))
  if (version[0] !== VARINT.VERSION[0]) {
    throw new TypeError(
      `Invalid version sigil expected 0x${VERSION.toString(16)} got 0x${hex.encode(version)}`
    )
  }
  const [code] = varint.decode(buf, 2)

  switch (SIG_PREFIX[code]) {
    case 'RSA': {
      return {
        alg: getPreset(bytes.readBytes(5), ['RS256']),
        enc: getEncoding(bytes.readBytes(1)),
      }
    }
    case 'EdDSA': {
      return {
        alg: getPreset(bytes.readBytes(5), ['Ed25519']),
        enc: getEncoding(bytes.readBytes(1)),
      }
    }
    case 'ECDSA': {
      const isEIP191 = varint.decode(buf, 2 + 5)[0] === EIP191_ENCODING
      if (isEIP191) {
        return {
          alg: getPreset(bytes.readBytes(8), ['EIP191']),
          enc: getEncoding(bytes.readBytes(1)),
        }
      }

      return {
        alg: getPreset(bytes.readBytes(5), [
          'ES256',
          'ES256K',
          'ES384',
          'ES512',
        ]),
        enc: getEncoding(bytes.readBytes(1)),
      }
    }
    default:
      throw new TypeError(`Unsupported algorithm ${code}`)
  }
}
