/**
 * ECDSA signature format conversion.
 *
 * A P-256 authenticator returns its signature as ASN.1 DER: a SEQUENCE of two
 * INTEGERs, r and s. WebCrypto's ECDSA `verify` does not accept that — it wants
 * the IEEE P1363 "raw" form, r and s as fixed-width big-endian values
 * concatenated, exactly 64 bytes for P-256.
 *
 * Handing a DER signature straight to `subtle.verify` therefore fails for every
 * genuine assertion, which is silent because `verify` returns false rather than
 * throwing.
 *
 * DER also encodes integers as signed, so a value whose top bit is set gets a
 * leading 0x00 byte, and leading zeroes are dropped. Both have to be undone
 * when converting to the fixed-width form.
 */

const P256_COORDINATE_BYTES = 32
const DER_SEQUENCE = 0x30
const DER_INTEGER = 0x02

/**
 * Is this an ASN.1 DER ECDSA signature rather than a raw r||s pair?
 *
 * @param {Uint8Array} signature
 */
export function isDerSignature(signature) {
  return signature.length > 2 && signature[0] === DER_SEQUENCE
}

/**
 * Read one DER INTEGER, returning its unsigned big-endian bytes.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {[value: Uint8Array, nextOffset: number]}
 */
function readDerInteger(bytes, offset) {
  if (bytes[offset] !== DER_INTEGER) {
    throw new Error(
      `Malformed DER signature: expected INTEGER at offset ${offset}`
    )
  }

  const length = bytes[offset + 1]
  // Long-form lengths would mean an integer of 128+ bytes, which cannot occur
  // for P-256, so anything with the high bit set is malformed here.
  if (length === undefined || length & 0x80) {
    throw new Error('Malformed DER signature: unsupported INTEGER length')
  }

  const start = offset + 2
  const end = start + length
  if (end > bytes.length) {
    throw new Error('Malformed DER signature: INTEGER runs past end')
  }

  let value = bytes.subarray(start, end)
  // DER integers are signed, so a leading 0x00 may be padding that keeps a
  // high-bit-set value positive. Strip it.
  while (value.length > 1 && value[0] === 0x00) {
    value = value.subarray(1)
  }

  return [value, end]
}

/**
 * Left-pad to a fixed width, as P1363 requires.
 *
 * @param {Uint8Array} value
 * @param {number} width
 */
function padStart(value, width) {
  if (value.length > width) {
    throw new Error(
      `Malformed DER signature: component is ${value.length} bytes, expected at most ${width}`
    )
  }
  const padded = new Uint8Array(width)
  padded.set(value, width - value.length)
  return padded
}

/**
 * Convert an ASN.1 DER ECDSA signature to the raw r||s form WebCrypto expects.
 *
 * Passing an already-raw 64-byte signature returns it unchanged, so callers do
 * not have to know which form they hold.
 *
 * @param {Uint8Array} signature
 * @returns {Uint8Array} 64 bytes: r || s
 */
export function derToRawSignature(signature) {
  if (!isDerSignature(signature)) {
    if (signature.length !== P256_COORDINATE_BYTES * 2) {
      throw new Error(
        `Unexpected signature length: ${signature.length}, expected 64 raw bytes or ASN.1 DER`
      )
    }
    return signature
  }

  const declaredLength = signature[1]
  if (declaredLength & 0x80) {
    throw new Error('Malformed DER signature: unsupported SEQUENCE length')
  }
  if (declaredLength + 2 !== signature.length) {
    throw new Error(
      `Malformed DER signature: SEQUENCE declares ${declaredLength} bytes, got ${signature.length - 2}`
    )
  }

  const [r, afterR] = readDerInteger(signature, 2)
  const [s, afterS] = readDerInteger(signature, afterR)

  if (afterS !== signature.length) {
    throw new Error('Malformed DER signature: trailing bytes after s')
  }

  const raw = new Uint8Array(P256_COORDINATE_BYTES * 2)
  raw.set(padStart(r, P256_COORDINATE_BYTES), 0)
  raw.set(padStart(s, P256_COORDINATE_BYTES), P256_COORDINATE_BYTES)
  return raw
}
