/**
 * UTF-8 codec
 *
 * @module
 */
import { buf, isBufferSource, u8 } from './utils.js'

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
    if (globalThis.Buffer) {
      return buf(input).toString('utf8')
    }

    return textDecoder.decode(input)
  },
  decode(input) {
    if (isBufferSource(input)) {
      return u8(input)
    }
    if (globalThis.Buffer) {
      return u8(buf(input))
    }
    return textEncoder.encode(input)
  },
}
