/**
 * UTF-8 codec
 *
 * @module
 */
import { isUint8Array, u8 } from './utils.js'

const textDecoder = new TextDecoder()
const textEncoder = new TextEncoder()
/**
 * @type {import("./types").Codec}
 */
export const utf8 = {
  encode(input) {
    if (typeof input === 'string') {
      return input
    }

    return textDecoder.decode(input)
  },
  decode(input) {
    if (isUint8Array(input)) {
      return u8(input)
    }
    return textEncoder.encode(input)
  },
}
