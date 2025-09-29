import {
  encodeBitString,
  encodeSequence,
  enterSequence,
  readBitString,
  skipSequence,
} from './asn1.js'

/**
 * SPKI
 */

const SPKI_PARAMS_ENCODED = new Uint8Array([
  48, 13, 6, 9, 42, 134, 72, 134, 247, 13, 1, 1, 1, 5, 0,
])

/**
 * @param {Uint8Array} key
 */
function encode(key) {
  return encodeSequence([SPKI_PARAMS_ENCODED, encodeBitString(key)])
}

/**
 * @param {Uint8Array} info
 */
function decode(info) {
  // go into the top-level SEQUENCE
  const offset = enterSequence(info, 0)
  // skip the header we expect (SKPI_PARAMS_ENCODED)
  const keyOffset = skipSequence(info, offset)

  // we expect the bitstring next
  return readBitString(info, keyOffset)
}
export const spki = {
  encode,
  decode,
}
