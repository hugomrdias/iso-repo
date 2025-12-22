/**
 * Fast base encoding / decoding of any given alphabet using bitcoin style leading zero compression.
 *
 * Uses {@link https://github.com/cryptocoinjs/base-x | cryptocoinjs/base-x} to build a {@link Codec} factory and prefines `base10`, `base36` and `base58btc` alphabets and {@link Codec | Codecs}.
 *
 * @module
 */

import { baseX as _baseX } from './bases/basex.js'
import { bases } from './bases/lookup.js'
import { utf8 } from './utf8.js'
import { isUint8Array, u8 } from './utils.js'

/** @typedef {import('./types.js').Codec} Codec */

/**
 * Base X Factory
 *
 * @param {string} base
 * @returns {Codec}
 */
export function baseX(base) {
  const [, alphabet] = bases[base]
  return {
    encode(input, _pad) {
      if (typeof input === 'string') {
        input = utf8.decode(input)
      }
      return _baseX(alphabet).encode(u8(input))
    },
    decode(input) {
      if (isUint8Array(input)) {
        input = utf8.encode(input)
      }

      return _baseX(alphabet).decode(input)
    },
  }
}

export const base10 = baseX('base10')
export const base36 = baseX('base36')
export const base58btc = baseX('base58btc')
