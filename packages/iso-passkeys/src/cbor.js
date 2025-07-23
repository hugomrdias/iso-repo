import { decode, Encoder, encode } from 'cbor-x'

const encoder = new Encoder({
  mapsAsObjects: false,
  tagUint8Array: false,
})

/**
 * Decode and return the first item in a sequence of CBOR-encoded values
 *
 * @template Type
 * @param {Uint8Array} input - The CBOR data to decode
 * @returns {Type}
 */
export function stableDecode(input) {
  const decoded = encoder.decodeMultiple(input)

  if (decoded === undefined) {
    throw new Error('CBOR input data was empty')
  }

  const [first] = /** @type {[Type]} */ (/** @type {unknown} */ (decoded))

  return first
}

/**
 * Encode data to CBOR
 *
 * @param {any} input
 */
export function stableEncode(input) {
  return Uint8Array.from(encoder.encode(input))
}

export const cborStable = {
  decode: stableDecode,
  encode: stableEncode,
}

export const cbor = {
  decode,
  encode,
}
