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
  let offset = 2
  const [innerAlgorithm, innerAlgorithmLen] = varintDecode(varsig, offset)
  offset += innerAlgorithmLen
  const [curve, curveLen] = varintDecode(varsig, offset)
  offset += curveLen
  const [webauthnMarker, markerLen] = varintDecode(varsig, offset)
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
  const [clientDataLen, clientDataLenLen] = varintDecode(varsig, offset)
  offset += clientDataLenLen

  if (offset + clientDataLen > varsig.length) {
    throw new Error('Invalid clientDataJSON length')
  }

  const clientDataJSON = varsig.slice(offset, offset + clientDataLen)
  offset += clientDataLen

  const [authDataLen, authDataLenLen] = varintDecode(varsig, offset)
  offset += authDataLenLen

  if (offset + authDataLen > varsig.length) {
    throw new Error('Invalid authenticatorData length')
  }

  const authenticatorData = varsig.slice(offset, offset + authDataLen)
  offset += authDataLen

  const [signatureHashAlgorithm, sigHashLen] = varintDecode(varsig, offset)
  offset += sigHashLen
  const [encodingInfo, encInfoLen] = varintDecode(varsig, offset)
  offset += encInfoLen

  const signature = varsig.slice(offset)
  if (signature.length === 0) {
    throw new Error('Signature is empty')
  }

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
