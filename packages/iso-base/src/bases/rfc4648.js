/**
 * RFC4648 codec factory and predefines `base2`, `base8`, `hex`, `base16`, `base32`, `base32hex`, `base64` and `base64url` alphabets and {@link Codec | Codecs}.
 *
 * @module
 */

/** @typedef {import('../types.js').Codec} Codec */

import { utf8 } from '../utf8.js'
import { isUint8Array, u8 } from '../utils.js'
import { bases } from './lookup.js'

/**
 * Decode
 *
 * @param {string} string - Encoded string
 * @param {number} bitsPerChar - Bits per character
 * @param {Record<string, number>} codes - Character lookup table
 * @returns {Uint8Array} - Decoded data
 */
const decode = (string, bitsPerChar, codes) => {
  // Count the padding bytes:
  let end = string.length
  while (string[end - 1] === '=') {
    --end
  }

  // Allocate the output:
  const out = new Uint8Array(((end * bitsPerChar) / 8) | 0)

  // Parse the data:
  let bits = 0 // Number of bits currently in the buffer
  let buffer = 0 // Bits waiting to be written out, MSB first
  let written = 0 // Next byte to write
  for (let i = 0; i < end; ++i) {
    // Read one character from the string:
    const value = codes[string[i]]
    if (value === undefined) {
      throw new SyntaxError(`Invalid character ${string[i]}`)
    }

    // Append the bits to the buffer:
    buffer = (buffer << bitsPerChar) | value
    bits += bitsPerChar

    // Write out some bits if the buffer has a byte's worth:
    if (bits >= 8) {
      bits -= 8
      out[written++] = 0xff & (buffer >> bits)
    }
  }

  // Verify that we have received just enough bits:
  if (bits >= bitsPerChar || 0xff & (buffer << (8 - bits))) {
    throw new SyntaxError('Unexpected end of data')
  }

  return out
}

/**
 * Encode
 *
 * @param {Uint8Array} data - Data to encode
 * @param {string} alphabet - Alphabet
 * @param {number} bitsPerChar - Bits per character
 * @param {boolean} pad - Pad
 */
const encode = (data, alphabet, bitsPerChar, pad) => {
  const mask = (1 << bitsPerChar) - 1
  let out = ''

  let bits = 0 // Number of bits currently in the buffer
  let buffer = 0 // Bits waiting to be written out, MSB first
  for (const datum of data) {
    // Slurp data into the buffer:
    buffer = (buffer << 8) | datum
    bits += 8

    // Write out as much as we can:
    while (bits > bitsPerChar) {
      bits -= bitsPerChar
      out += alphabet[mask & (buffer >> bits)]
    }
  }

  // Partial character:
  if (bits) {
    out += alphabet[mask & (buffer << (bitsPerChar - bits))]
  }

  // Add padding characters until we hit a byte boundary:
  if (pad) {
    while ((out.length * bitsPerChar) & 7) {
      out += '='
    }
  }

  return out
}

/**
 * RFC4648 Factory
 *
 * @param {string} base - Base
 * @param {boolean} [padding] - Padding
 * @param {((str: string) => string)} [normalize] - Normalize
 * @returns {Codec} - Codec
 */

// biome-ignore lint/style/useDefaultParameterLast: needed
export function rfc4648(base, padding = false, normalize) {
  const [bits, alphabet, codes] = bases[base]
  return {
    encode(input, pad) {
      if (typeof input === 'string') {
        input = utf8.decode(input)
      }

      return encode(u8(input), alphabet, bits, pad ?? padding)
    },
    decode(input) {
      if (isUint8Array(input)) {
        input = utf8.encode(input)
      }

      if (normalize) {
        input = normalize(input)
      }

      return decode(input, bits, codes)
    },
  }
}

/**
 * Has Native Hex Support
 * @see https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
 */
export const HAS_NATIVE_HEX_SUPPORT = 'fromHex' in Uint8Array
export const HAS_NATIVE_BASE64_SUPPORT = 'fromBase64' in Uint8Array

/**
 * Native Hex Support
 * @type {Codec}
 */
export const nativeHex = {
  encode(input) {
    if (typeof input === 'string') {
      input = utf8.decode(input)
    }

    return input.toHex()
  },
  decode(input) {
    if (isUint8Array(input)) {
      input = utf8.encode(input)
    }
    return Uint8Array.fromHex(input)
  },
}

// ASCII whitespace is U+0009 TAB, U+000A LF, U+000C FF, U+000D CR, or U+0020 SPACE
const ASCII_WHITESPACE = /[\t\n\f\r ]/

/**
 * Native Base64 Support Padded
 *
 * @see https://caniuse.com/mdn-javascript_builtins_uint8array_frombase64
 * @param {'base64' | 'base64url'} base - Base
 * @returns {Codec}
 */
export function nativeBase64(base, padding = false) {
  return {
    encode(input, pad) {
      if (typeof input === 'string') {
        input = utf8.decode(input)
      }
      return input.toBase64({ alphabet: base, omitPadding: !(pad ?? padding) })
    },
    decode(input) {
      if (isUint8Array(input)) {
        input = utf8.encode(input)
      }
      if (input.length > 0 && ASCII_WHITESPACE.test(input)) {
        throw new SyntaxError('invalid base64')
      }
      return Uint8Array.fromBase64(input, {
        alphabet: base,
        lastChunkHandling: padding ? 'strict' : 'loose',
      })
    },
  }
}
