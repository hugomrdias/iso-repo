import _baseX from 'base-x'
import { utf8 } from './utf8.js'
import { isBufferSource, u8 } from './utils.js'

/** @typedef {import('./types.js').Codec} Codec */

/** @type {Record<string, string>} */
const bases = {
  base10: '0123456789',
  base36: '0123456789abcdefghijklmnopqrstuvwxyz',
  base58btc: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
}

/**
 * RFC4648 Factory
 *
 * @param {string} base
 * @returns {Codec}
 */
export function baseX(base) {
  const alphabet = bases[base]
  return {
    encode(input, pad) {
      if (typeof input === 'string') {
        input = utf8.decode(input)
      }
      return _baseX(alphabet).encode(u8(input))
    },
    decode(input) {
      if (isBufferSource(input)) {
        input = utf8.encode(input)
      }

      return _baseX(alphabet).decode(input)
    },
  }
}

export const base10 = baseX('base10')
export const base36 = baseX('base36')
export const base58btc = baseX('base58btc')
