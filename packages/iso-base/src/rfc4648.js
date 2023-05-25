/**
 * RFC4648 codec factory and predefines `base2`, `base8`, `hex`, `base16`, `base32`, `base32hex`, `base64` and `base64url` alphabets and {@link Codec | Codecs}.
 *
 * @module
 */

/* eslint-disable unicorn/prefer-math-trunc */
/* eslint-disable unicorn/no-for-loop */
/** @typedef {import('./types').Codec} Codec */

import { utf8 } from './utf8.js'
import { buf, isBufferSource, u8 } from './utils.js'
/**
 * @param {string} string
 * @param {string} alphabet
 * @param {number} bitsPerChar
 * @returns {Uint8Array}
 */
const decode = (string, alphabet, bitsPerChar) => {
  // Build the character lookup table:
  /** @type {Record<string, number>} */
  const codes = {}
  for (let i = 0; i < alphabet.length; ++i) {
    codes[alphabet[i]] = i
  }

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
      throw new SyntaxError('Invalid character ' + string[i])
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
 * @param {Uint8Array} data
 * @param {string} alphabet
 * @param {number} bitsPerChar
 * @param {boolean} pad
 * @returns {string}
 */
const encode = (data, alphabet, bitsPerChar, pad) => {
  const mask = (1 << bitsPerChar) - 1
  let out = ''

  let bits = 0 // Number of bits currently in the buffer
  let buffer = 0 // Bits waiting to be written out, MSB first
  for (let i = 0; i < data.length; ++i) {
    // Slurp data into the buffer:
    buffer = (buffer << 8) | data[i]
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

/** @type {Record<string, [number, string]>} */
const bases = {
  base2: [1, '01'],
  base8: [3, '01234567'],
  hex: [4, '0123456789abcdef'],
  base16: [4, '0123456789ABCDEF'],
  base32: [5, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'],
  base32hex: [5, '0123456789ABCDEFGHIJKLMNOPQRSTUV'],
  base64: [
    6,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  ],
  base64url: [
    6,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  ],
}

/**
 * RFC4648 Factory
 *
 * @param {string} base
 * @param {boolean} [padding]
 * @param {((str: string) => string)} [normalize]
 * @returns {Codec}
 */
export function rfc4648(base, padding = true, normalize) {
  const [bits, alphabet] = bases[base]
  return {
    encode(input, pad) {
      if (base === 'hex' && globalThis.Buffer) {
        return buf(input).toString('hex')
      }

      if (base === 'base64' && globalThis.Buffer && !pad) {
        return buf(input).toString('base64')
      }

      if (base === 'base64url' && globalThis.Buffer && !pad) {
        return buf(input).toString('base64url')
      }

      if (typeof input === 'string') {
        if (normalize) {
          input = normalize(input)
        }
        input = utf8.decode(input)
      }

      return encode(u8(input), alphabet, bits, pad ?? padding)
    },
    decode(input) {
      if (isBufferSource(input)) {
        input = utf8.encode(input)
      }
      if (base === 'hex' && globalThis.Buffer) {
        return u8(buf(input, 'hex'))
      }

      if (base === 'base64' && globalThis.Buffer) {
        return u8(buf(input, 'base64'))
      }

      if (base === 'base64url' && globalThis.Buffer) {
        return u8(buf(input, 'base64url'))
      }

      if (normalize) {
        input = normalize(input)
      }

      return decode(input, alphabet, bits)
    },
  }
}

/**
 * Matches node
 */
export const hex = rfc4648('hex', true, (str) => str.toLowerCase())
export const base2 = rfc4648('base2')
export const base8 = rfc4648('base8')
export const base16 = rfc4648('base16')
export const base32 = rfc4648('base32')
export const base32hex = rfc4648('base32hex')
export const base64 = rfc4648('base64')
export const base64pad = rfc4648('base64', true)
/**
 * Base 64 URL
 *
 * Padding is skipped by default
 */
export const base64url = rfc4648('base64url', false)
