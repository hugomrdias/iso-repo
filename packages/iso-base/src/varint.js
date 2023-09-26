/**
 * Variable length integer encoding with helpers for tagging Uint8Arrays with multicodec prefixes.
 *
 * @module
 */
/* eslint-disable no-nested-ternary */
const MSB = 0x80
const REST = 0x7f
const MSBALL = ~REST
const INT = Math.pow(2, 31)

/**
 * @param {number} num
 * @param {Uint8Array} out
 * @param {number} offset
 */
function encode(num, out, offset = 0) {
  out = out || []
  const oldOffset = offset

  while (num >= INT) {
    out[offset++] = (num & 0xff) | MSB
    num /= 128
  }
  while (num & MSBALL) {
    out[offset++] = (num & 0xff) | MSB
    num >>>= 7
  }
  // eslint-disable-next-line unicorn/prefer-math-trunc
  out[offset] = num | 0

  // @ts-ignore
  encode.bytes = offset - oldOffset + 1

  return out
}

const MSB$1 = 0x80
const REST$1 = 0x7f

/**
 * @param {Uint8Array} buf
 * @param {number} [offset]
 * @returns {[code: number, size: number]}
 */
function decode(buf, offset = 0) {
  let res = 0
  let shift = 0
  let counter = offset
  let b
  let bytes = 0
  const l = buf.length

  do {
    if (counter >= l) {
      bytes = 0
      throw new RangeError('Could not decode varint')
    }
    b = buf[counter++]
    res +=
      shift < 28 ? (b & REST$1) << shift : (b & REST$1) * Math.pow(2, shift)
    shift += 7
  } while (b >= MSB$1)

  bytes = counter - offset

  return [res, bytes]
}

const N1 = Math.pow(2, 7)
const N2 = Math.pow(2, 14)
const N3 = Math.pow(2, 21)
const N4 = Math.pow(2, 28)
const N5 = Math.pow(2, 35)
const N6 = Math.pow(2, 42)
const N7 = Math.pow(2, 49)
const N8 = Math.pow(2, 56)
const N9 = Math.pow(2, 63)

const length = function (/** @type {number} */ value) {
  return value < N1
    ? 1
    : value < N2
    ? 2
    : value < N3
    ? 3
    : value < N4
    ? 4
    : value < N5
    ? 5
    : value < N6
    ? 6
    : value < N7
    ? 7
    : value < N8
    ? 8
    : value < N9
    ? 9
    : 10
}

export const varint = {
  encode,
  decode,
  encodingLength: length,
}

/**
 * @param {number} code
 * @param {Uint8Array} bytes
 */
export function tag(code, bytes) {
  const offset = varint.encodingLength(code)
  const taggedBytes = new Uint8Array(bytes.byteLength + offset)
  varint.encode(code, taggedBytes, 0)
  taggedBytes.set(bytes, offset)

  return taggedBytes
}

/**
 * @param {number} code
 * @param {Uint8Array} taggedBytes
 */
export function untag(code, taggedBytes) {
  const [tag, size] = varint.decode(taggedBytes)
  if (tag === code) {
    return new Uint8Array(
      taggedBytes.buffer,
      taggedBytes.byteOffset + size,
      taggedBytes.byteLength - size
    )
  } else {
    throw new Error(
      `Expected multiformat with codec 0x${code.toString(
        16
      )} tag instead got 0x${tag.toString(16)}`
    )
  }
}
