import {
  CURVE_ED25519,
  CURVE_P256,
  INNER_ECDSA,
  INNER_EDDSA,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  WEBAUTHN_WRAPPER,
} from './multicodec.js'
import { varintDecode } from './utils.js'

/**
 * @typedef {import('./types').DecodedVarsigV1} DecodedVarsigV1
 * @typedef {import('./types').ClientDataJSON} ClientDataJSON
 * @typedef {import('./types').SignatureAlgorithm} SignatureAlgorithm
 */

/**
 * Read a varint, failing with a decode error rather than letting the read run
 * off the end of the buffer.
 *
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} what - Field name, for the error message.
 * @returns {[value: number, length: number]}
 */
function readVarint(bytes, offset, what) {
  if (offset >= bytes.length) {
    throw new Error(`Varsig truncated: no ${what} at offset ${offset}`)
  }
  try {
    return varintDecode(bytes, offset)
  } catch {
    throw new Error(`Varsig truncated: malformed ${what} at offset ${offset}`)
  }
}

/**
 * Reject trailing bytes after the signature.
 *
 * Ed25519 signatures are always 64 bytes. ECDSA signatures from a WebAuthn
 * authenticator are ASN.1 DER, whose SEQUENCE header declares its own length;
 * raw r||s is accepted too, at a fixed 64 bytes.
 *
 * @param {SignatureAlgorithm} algorithm
 * @param {Uint8Array} signature
 */
function assertSignatureIsExact(algorithm, signature) {
  if (algorithm === 'Ed25519') {
    if (signature.length !== 64) {
      throw new Error(
        `Invalid Ed25519 signature length: ${signature.length}, expected 64`
      )
    }
    return
  }

  // DER: 0x30 <length> ...
  if (signature[0] === 0x30) {
    const declared = signature[1]
    if (declared & 0x80) {
      throw new Error('Malformed DER signature: unsupported SEQUENCE length')
    }
    if (declared + 2 !== signature.length) {
      throw new Error(
        `Trailing bytes after signature: DER declares ${declared + 2}, got ${signature.length}`
      )
    }
    return
  }

  if (signature.length !== 64) {
    throw new Error(
      `Invalid P-256 signature length: ${signature.length}, expected 64 raw bytes or ASN.1 DER`
    )
  }
}

/**
 * Decode a WebAuthn varsig v1 (non-recursive layout) into its components.
 *
 * Wire format:
 *   header: prefix version innerAlgorithm curve webauthnMarker
 *   body:   clientDataLen clientDataJSON authDataLen authenticatorData
 *           signatureHashAlgorithm encodingInfo signatureBytes
 *
 * @param {Uint8Array} varsig
 * @returns {DecodedVarsigV1}
 */
export function decodeWebAuthnVarsigV1(varsig) {
  if (varsig.length < 2) {
    throw new Error('Varsig too short')
  }

  if (varsig[0] !== VARSIG_PREFIX || varsig[1] !== VARSIG_VERSION) {
    throw new Error('Unsupported varsig header')
  }

  // --- header: 3 varints ---
  // readVarint bounds-checks first. Without it a truncated buffer reaches
  // iso-base's varint.decode, which reads `undefined` bytes — `undefined & 0x7f`
  // is 0 and `undefined < 0x80` is false — walks eight phantom bytes and throws
  // a bare RangeError from a dependency instead of a decode error from here.
  let offset = 2
  const [innerAlgorithm, innerAlgorithmLen] = readVarint(
    varsig,
    offset,
    'signature algorithm'
  )
  offset += innerAlgorithmLen
  const [curve, curveLen] = readVarint(varsig, offset, 'curve')
  offset += curveLen
  const [webauthnMarker, markerLen] = readVarint(
    varsig,
    offset,
    'WebAuthn marker'
  )
  offset += markerLen

  /** @type {SignatureAlgorithm | null} */
  const algorithm =
    innerAlgorithm === INNER_EDDSA
      ? 'Ed25519'
      : innerAlgorithm === INNER_ECDSA
        ? 'P-256'
        : null

  if (!algorithm) {
    throw new Error(
      `Unsupported signature algorithm: 0x${innerAlgorithm.toString(16)}`
    )
  }

  if (algorithm === 'Ed25519' && curve !== CURVE_ED25519) {
    throw new Error(`Unexpected Ed25519 curve code: 0x${curve.toString(16)}`)
  }

  if (algorithm === 'P-256' && curve !== CURVE_P256) {
    throw new Error(`Unexpected P-256 curve code: 0x${curve.toString(16)}`)
  }

  if (webauthnMarker !== WEBAUTHN_WRAPPER) {
    throw new Error('Missing WebAuthn extension marker')
  }

  // --- body: clientData, authData, signature metadata, signature ---
  const [clientDataLen, clientDataLenLen] = readVarint(
    varsig,
    offset,
    'clientDataJSON length'
  )
  offset += clientDataLenLen

  if (offset + clientDataLen > varsig.length) {
    throw new Error('Invalid clientDataJSON length')
  }

  const clientDataJSON = varsig.slice(offset, offset + clientDataLen)
  offset += clientDataLen

  const [authDataLen, authDataLenLen] = readVarint(
    varsig,
    offset,
    'authenticatorData length'
  )
  offset += authDataLenLen

  if (offset + authDataLen > varsig.length) {
    throw new Error('Invalid authenticatorData length')
  }

  const authenticatorData = varsig.slice(offset, offset + authDataLen)
  offset += authDataLen

  const [signatureHashAlgorithm, sigHashLen] = readVarint(
    varsig,
    offset,
    'signature hash algorithm'
  )
  offset += sigHashLen
  const [encodingInfo, encInfoLen] = readVarint(varsig, offset, 'encoding info')
  offset += encInfoLen

  const signature = varsig.slice(offset)
  if (signature.length === 0) {
    throw new Error('Signature is empty')
  }

  // The signature is not length-prefixed, so it absorbs whatever is left in the
  // buffer. Both algorithms are self-delimiting, so trailing bytes can still be
  // rejected — otherwise one logical signature would have unboundedly many
  // valid encodings, which a content-addressed format cannot tolerate.
  assertSignatureIsExact(algorithm, signature)

  return {
    algorithm,
    innerAlgorithm,
    curve,
    webauthnMarker,
    authenticatorData,
    clientDataJSON,
    signatureHashAlgorithm,
    encodingInfo,
    signature,
  }
}

/**
 * Parse clientDataJSON bytes into structured data.
 *
 * @param {Uint8Array} bytes
 * @returns {ClientDataJSON}
 */
export function parseClientDataJSON(bytes) {
  try {
    const json = new TextDecoder().decode(bytes)
    const parsed = JSON.parse(json)

    return {
      type: parsed.type,
      challenge: parsed.challenge,
      origin: parsed.origin,
      crossOrigin: parsed.crossOrigin,
    }
  } catch (error) {
    throw new Error(
      `Failed to parse clientDataJSON: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
