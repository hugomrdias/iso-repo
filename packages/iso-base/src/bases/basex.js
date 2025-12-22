// base-x encoding / decoding - Hybrid optimized version
// Original Copyright (c) 2018 base-x contributors
// Copyright (c) 2014-2018 The Bitcoin Core developers (base58.cpp)
// Distributed under the MIT software license, see the accompanying
// file LICENSE or http://www.opensource.org/licenses/mit-license.php.

import { isUint8Array } from '../utils.js'

/**
 * Creates an optimized base-x codec using a hybrid approach:
 * - Small inputs (≤64 bytes): Original byte-by-byte algorithm (lower overhead)
 * - Large inputs (>64 bytes): BigInt-based O(n) conversion (scales better)
 *
 * @param {string} ALPHABET - The alphabet to use for encoding/decoding
 * @returns {{ encode: (source: Uint8Array) => string, decode: (source: string) => Uint8Array, decodeUnsafe: (source: string) => Uint8Array | undefined }}
 *
 * @example
 * ```ts twoslash
 * import base from 'iso-base/bases/basex'
 *
 * const base58 = base('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')
 * const encoded = base58.encode(new Uint8Array([1, 2, 3]))
 * const decoded = base58.decode(encoded)
 * ```
 */
export function baseX(ALPHABET) {
  const ALPHABET_LENGTH = ALPHABET.length
  if (ALPHABET_LENGTH >= 255) {
    throw new TypeError('Alphabet too long')
  }

  // Build lookup table for decoding
  const BASE_MAP = new Uint8Array(256).fill(255)
  for (let i = 0; i < ALPHABET_LENGTH; i++) {
    const xc = ALPHABET.charCodeAt(i)
    if (BASE_MAP[xc] !== 255) {
      throw new TypeError(`${ALPHABET[i]} is ambiguous`)
    }
    BASE_MAP[xc] = i
  }

  const BASE = ALPHABET_LENGTH
  const BASE_BIGINT = BigInt(ALPHABET_LENGTH)
  const LEADER = ALPHABET.charAt(0)

  // Pre-computed factors for small input path
  const FACTOR = Math.log(BASE) / Math.log(256)
  const iFACTOR = Math.log(256) / Math.log(BASE)

  // Threshold for switching to BigInt (tuned from benchmarks)
  // Higher threshold ensures small inputs use the low-overhead byte-by-byte path
  const BIGINT_THRESHOLD = 64

  // ============================================
  // SMALL INPUT: Original byte-by-byte algorithm
  // ============================================

  /**
   * @param {Uint8Array} src
   * @returns {string}
   */
  function encodeSmall(src) {
    const srcLength = src.length

    // Count leading zeroes
    let zeroes = 0
    let pbegin = 0
    while (pbegin < srcLength && src[pbegin] === 0) {
      pbegin++
      zeroes++
    }

    // Allocate enough space in big-endian base representation
    const size = ((srcLength - pbegin) * iFACTOR + 1) >>> 0
    const b58 = new Uint8Array(size)

    let length = 0

    // Process the bytes
    while (pbegin < srcLength) {
      let carry = src[pbegin++]

      // Apply "b58 = b58 * 256 + ch"
      let i = 0
      for (
        let it1 = size - 1;
        (carry !== 0 || i < length) && it1 !== -1;
        it1--, i++
      ) {
        carry += (256 * b58[it1]) >>> 0
        b58[it1] = (carry % BASE) >>> 0
        carry = (carry / BASE) >>> 0
      }
      length = i
    }

    // Skip leading zeroes in base58 result
    let it2 = size - length
    while (it2 !== size && b58[it2] === 0) {
      it2++
    }

    // Translate the result into a string
    let str = LEADER.repeat(zeroes)
    for (; it2 < size; ++it2) {
      str += ALPHABET.charAt(b58[it2])
    }
    return str
  }

  /**
   * @param {string} source
   * @returns {Uint8Array | undefined}
   */
  function decodeSmall(source) {
    const sourceLength = source.length

    // Count leading zeros (leader characters)
    let zeroes = 0
    let psz = 0
    while (psz < sourceLength && source[psz] === LEADER) {
      zeroes++
      psz++
    }

    // Allocate enough space in big-endian base256 representation
    const size = ((sourceLength - psz) * FACTOR + 1) >>> 0
    const b256 = new Uint8Array(size)

    let length = 0

    // Process the characters
    while (psz < sourceLength) {
      const charCode = source.charCodeAt(psz)

      // Fast reject for non-ASCII
      if (charCode > 255) {
        return undefined
      }

      // Decode character
      let carry = BASE_MAP[charCode]
      if (carry === 255) {
        return undefined
      }

      // Apply "b256 = b256 * BASE + carry"
      let i = 0
      for (
        let it3 = size - 1;
        (carry !== 0 || i < length) && it3 !== -1;
        it3--, i++
      ) {
        carry += (BASE * b256[it3]) >>> 0
        b256[it3] = (carry & 0xff) >>> 0
        carry = carry >>> 8
      }
      length = i
      psz++
    }

    // Skip leading zeroes in b256
    let it4 = size - length
    while (it4 !== size && b256[it4] === 0) {
      it4++
    }

    // Build result
    const resultLength = zeroes + (size - it4)
    const vch = new Uint8Array(resultLength)

    // Copy decoded bytes
    let j = zeroes
    while (it4 !== size) {
      vch[j++] = b256[it4++]
    }

    return vch
  }

  // ============================================
  // LARGE INPUT: BigInt-based algorithm
  // ============================================

  /**
   * @param {Uint8Array} src
   * @returns {string}
   */
  function encodeBigInt(src) {
    const srcLength = src.length

    // Count leading zeroes
    let zeroes = 0
    while (zeroes < srcLength && src[zeroes] === 0) {
      zeroes++
    }

    // All zeroes case
    if (zeroes === srcLength) {
      return LEADER.repeat(srcLength)
    }

    // Convert buffer to BigInt using bitwise shift
    let value = 0n
    for (let i = zeroes; i < srcLength; i++) {
      value = (value << 8n) | BigInt(src[i])
    }

    // Convert to base-x string
    /** @type {string[]} */
    const digits = []
    while (value > 0n) {
      const remainder = Number(value % BASE_BIGINT)
      digits.push(ALPHABET[remainder])
      value /= BASE_BIGINT
    }

    return LEADER.repeat(zeroes) + digits.reverse().join('')
  }

  /**
   * @param {string} source
   * @returns {Uint8Array | undefined}
   */
  function decodeBigInt(source) {
    const sourceLength = source.length

    // Count leading zeros (leader characters)
    let zeroes = 0
    while (zeroes < sourceLength && source[zeroes] === LEADER) {
      zeroes++
    }

    // All leaders case
    if (zeroes === sourceLength) {
      return new Uint8Array(zeroes)
    }

    // Convert base-x string to BigInt
    let value = 0n
    for (let i = zeroes; i < sourceLength; i++) {
      const charCode = source.charCodeAt(i)

      if (charCode > 255) {
        return undefined
      }

      const digit = BASE_MAP[charCode]
      if (digit === 255) {
        return undefined
      }

      value = value * BASE_BIGINT + BigInt(digit)
    }

    // Handle zero value after leaders
    if (value === 0n) {
      return new Uint8Array(zeroes + 1)
    }

    // Count bytes needed
    let temp = value
    let byteLength = 0
    while (temp > 0n) {
      temp >>= 8n
      byteLength++
    }

    // Create buffer
    const buffer = new Uint8Array(zeroes + byteLength)

    // Fill decoded bytes from right to left
    for (let i = buffer.length - 1; i >= zeroes; i--) {
      buffer[i] = Number(value & 0xffn)
      value >>= 8n
    }

    return buffer
  }

  // ============================================
  // PUBLIC API: Hybrid dispatch
  // ============================================

  /**
   * Encodes a Uint8Array to a base-x string
   * @param {Uint8Array} source
   * @returns {string}
   */
  function encode(source) {
    if (!isUint8Array(source)) {
      throw new TypeError('Expected Uint8Array')
    }

    if (source.length === 0) {
      return ''
    }

    // Choose algorithm based on input size
    return source.length <= BIGINT_THRESHOLD
      ? encodeSmall(source)
      : encodeBigInt(source)
  }

  /**
   * Decodes a base-x string to Uint8Array, returns undefined on invalid input
   * @param {string} source
   * @returns {Uint8Array | undefined}
   */
  function decodeUnsafe(source) {
    if (typeof source !== 'string') {
      throw new TypeError('Expected String')
    }

    if (source.length === 0) {
      return new Uint8Array(0)
    }

    // Choose algorithm based on input size
    // Note: decoded output is roughly 0.73x the string length for base58
    return source.length <= BIGINT_THRESHOLD
      ? decodeSmall(source)
      : decodeBigInt(source)
  }

  /**
   * Decodes a base-x string to Uint8Array, throws on invalid input
   * @param {string} source
   * @returns {Uint8Array}
   */
  function decode(source) {
    const buffer = decodeUnsafe(source)
    if (buffer) {
      return buffer
    }
    throw new Error(`Non-base${BASE} character`)
  }

  return {
    encode,
    decodeUnsafe,
    decode,
  }
}
