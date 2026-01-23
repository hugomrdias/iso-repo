import { varintDecode } from './utils.js'
import {
  VARSIG_PREFIX,
  VARSIG_VERSION,
  INNER_EDDSA,
  INNER_ECDSA,
  CURVE_ED25519,
  CURVE_P256,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  WEBAUTHN_WRAPPER,
  PAYLOAD_ENCODING_RAW,
} from './multicodec.js'

/**
 * @typedef {import('./types').DecodedVarsigV1} DecodedVarsigV1
 * @typedef {import('./types').ClientDataJSON} ClientDataJSON
 * @typedef {import('./types').SignatureAlgorithm} SignatureAlgorithm
 */

/**
 * Decode a WebAuthn varsig v1 into its components.
 *
 * Format:
 * - prefix (0x34)
 * - version (0x01)
 * - signature-algorithm metadata (varints)
 * - payload-encoding metadata (varint)
 * - assertion serialization
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

  let offset = 2
  const [innerAlgorithm, innerAlgorithmLen] = varintDecode(varsig, offset)
  offset += innerAlgorithmLen
  const [curve, curveLen] = varintDecode(varsig, offset)
  offset += curveLen
  const [multihashCode, multihashCodeLen] = varintDecode(varsig, offset)
  offset += multihashCodeLen
  const [multihashLength, multihashLengthLen] = varintDecode(varsig, offset)
  offset += multihashLengthLen
  const [webauthnMarker, markerLen] = varintDecode(varsig, offset)
  offset += markerLen
  const [payloadEncoding, payloadEncodingLen] = varintDecode(varsig, offset)
  offset += payloadEncodingLen

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

  if (multihashCode !== MULTIHASH_SHA256) {
    throw new Error('Unsupported multihash header')
  }

  if (multihashLength !== MULTIHASH_SHA256_LEN) {
    throw new Error('Unsupported multihash header length')
  }

  if (webauthnMarker !== WEBAUTHN_WRAPPER) {
    throw new Error('Missing WebAuthn extension marker')
  }

  if (payloadEncoding !== PAYLOAD_ENCODING_RAW) {
    throw new Error('Unsupported payload encoding')
  }

  const [authDataLen, authDataLenLen] = varintDecode(varsig, offset)
  offset += authDataLenLen

  if (offset + authDataLen > varsig.length) {
    throw new Error('Invalid authenticatorData length')
  }

  const authenticatorData = varsig.slice(offset, offset + authDataLen)
  offset += authDataLen

  const [clientDataLen, clientDataLenLen] = varintDecode(varsig, offset)
  offset += clientDataLenLen

  if (offset + clientDataLen > varsig.length) {
    throw new Error('Invalid clientDataJSON length')
  }

  const clientDataJSON = varsig.slice(offset, offset + clientDataLen)
  offset += clientDataLen

  const signature = varsig.slice(offset)
  if (signature.length === 0) {
    throw new Error('Signature is empty')
  }

  return {
    algorithm,
    innerAlgorithm,
    curve,
    multihashCode,
    multihashLength,
    webauthnMarker,
    payloadEncoding,
    authenticatorData,
    clientDataJSON,
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
