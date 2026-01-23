import { base64url } from 'iso-base/rfc4648'
import { concat as concatArrays, equals } from 'iso-base/utils'
import { varint } from 'iso-base/varint'

/**
 * Encode a number as unsigned varint (variable-length integer).
 *
 * @param {number} value
 */
export function varintEncode(value) {
  const [buf] = varint.encode(value)
  return buf
}

/**
 * Decode unsigned varint from bytes.
 *
 * @param {Uint8Array} bytes
 * @param {number} [offset]
 */
export function varintDecode(bytes, offset = 0) {
  return varint.decode(bytes, offset)
}

/**
 * Concatenate multiple Uint8Arrays.
 *
 * @param {Uint8Array[]} arrays
 */
export function concat(arrays) {
  return concatArrays(arrays)
}

/**
 * Convert base64url to Uint8Array.
 *
 * @param {string} base64urlValue
 */
export function base64urlToBytes(base64urlValue) {
  if (typeof base64urlValue !== 'string') {
    throw new TypeError('base64url string expected')
  }
  return base64url.decode(base64urlValue)
}

/**
 * Convert Uint8Array to base64url.
 *
 * @param {Uint8Array} bytes
 */
export function bytesToBase64url(bytes) {
  return base64url.encode(bytes)
}

/**
 * Compare two Uint8Arrays for equality.
 *
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
export function bytesEqual(a, b) {
  return equals(a, b)
}
