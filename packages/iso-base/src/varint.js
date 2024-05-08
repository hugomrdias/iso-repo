/* eslint-disable no-fallthrough */
/**
 * Variable length integer encoding with helpers for tagging Uint8Arrays with multicodec prefixes.
 *
 * @module
 */

/** Most significant bit of a byte */
const MSB = 0x80
/** Rest of the bits in a byte */
const REST = 0x7f

const N1 = 2 ** 7
const N2 = 2 ** 14
const N3 = 2 ** 21
const N4 = 2 ** 28
const N5 = 2 ** 35
const N6 = 2 ** 42
const N7 = 2 ** 49
// const N8 = Math.pow(2, 56)
// const N9 = Math.pow(2, 63)

/**
 *
 * @param {number} value
 */
export function encodingLength(value) {
  if (value < N1) {
    return 1
  }

  if (value < N2) {
    return 2
  }

  if (value < N3) {
    return 3
  }

  if (value < N4) {
    return 4
  }

  if (value < N5) {
    return 5
  }

  if (value < N6) {
    return 6
  }

  if (value < N7) {
    return 7
  }

  if (
    Number.MAX_SAFE_INTEGER !== undefined &&
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError('Could not encode varint')
  }

  return 8
}

/**
 * Encodes value into buffer starting at offset.
 * Returns Uint8Array, with the encoded varint written into it.
 * If Uint8Array is not provided, it will default to a new Uint8Array.
 *
 * @param {number} value
 * @param {Uint8Array} [buf]
 * @param {number} [offset]
 * @returns {[buf: Uint8Array, size: number]} - The buffer and the size of the encoded varint
 */
export function encode(value, buf, offset = 0) {
  const size = encodingLength(value)
  if (!buf) {
    buf = new Uint8Array(size)
  }

  switch (size) {
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 8: {
      buf[offset++] = (value & 0xff) | MSB
      value /= 128
    }
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 7: {
      buf[offset++] = (value & 0xff) | MSB
      value /= 128
    }
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 6: {
      buf[offset++] = (value & 0xff) | MSB
      value /= 128
    }
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 5: {
      buf[offset++] = (value & 0xff) | MSB
      value /= 128
    }
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 4: {
      buf[offset++] = (value & 0xff) | MSB
      value >>>= 7
    }
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 3: {
      buf[offset++] = (value & 0xff) | MSB
      value >>>= 7
    }
    // @ts-ignore
    // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
    case 2: {
      buf[offset++] = (value & 0xff) | MSB
      value >>>= 7
    }
    case 1: {
      buf[offset++] = value & 0xff
      value >>>= 7
      break
    }
    default: {
      throw new Error('unreachable')
    }
  }
  return [buf, size]
}

/**
 * Decodes buf from position offset or default 0 and returns the decoded original integer.
 *
 * @param {Uint8Array} buf
 * @param {number} [offset]
 * @returns {[code: number, size: number]} - The decoded integer and the size of the encoded varint
 */
export function decode(buf, offset = 0) {
  let b = buf[offset]
  let res = 0

  res += b & REST
  if (b < MSB) {
    return [res, 1]
  }

  b = buf[offset + 1]
  res += (b & REST) << 7
  if (b < MSB) {
    return [res, 2]
  }

  b = buf[offset + 2]
  res += (b & REST) << 14
  if (b < MSB) {
    return [res, 3]
  }

  b = buf[offset + 3]
  res += (b & REST) << 21
  if (b < MSB) {
    return [res, 4]
  }

  b = buf[offset + 4]
  res += (b & REST) * N4
  if (b < MSB) {
    return [res, 5]
  }

  b = buf[offset + 5]
  res += (b & REST) * N5
  if (b < MSB) {
    return [res, 6]
  }

  b = buf[offset + 6]
  res += (b & REST) * N6
  if (b < MSB) {
    return [res, 7]
  }

  b = buf[offset + 7]
  res += (b & REST) * N7
  if (b < MSB) {
    return [res, 8]
  }

  throw new RangeError('Could not decode varint')
}

export const varint = {
  encode,
  decode,
  encodingLength,
}

/**
 * Tag a Uint8Array with a multicodec prefix
 *
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
 * Untag a Uint8Array with a multicodec prefix
 *
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
  }
  throw new Error(
    `Expected multiformat with codec 0x${code.toString(
      16
    )} tag instead got 0x${tag.toString(16)}`
  )
}
