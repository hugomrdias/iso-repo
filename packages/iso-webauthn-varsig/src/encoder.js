import {
  CURVE_ED25519,
  CURVE_P256,
  INNER_ECDSA,
  INNER_EDDSA,
  MULTIHASH_SHA256,
  PAYLOAD_ENCODING_RAW,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  WEBAUTHN_WRAPPER,
} from './multicodec.js'
import { concat, varintEncode } from './utils.js'

/**
 * @typedef {import('./types').WebAuthnAssertion} WebAuthnAssertion
 * @typedef {import('./types').SignatureAlgorithm} SignatureAlgorithm
 * @typedef {import('./types').EncodeOptions} EncodeOptions
 */

/**
 * Encode a WebAuthn assertion as varsig v1 (non-recursive layout).
 *
 * Wire format:
 *   header: prefix version innerAlgorithm curve webauthnMarker
 *   body:   clientDataLen clientDataJSON authDataLen authenticatorData
 *           signatureHashAlgorithm encodingInfo signatureBytes
 *
 * @param {WebAuthnAssertion} assertion
 * @param {SignatureAlgorithm} [algorithm]
 * @param {EncodeOptions} [options]
 */
export function encodeWebAuthnVarsigV1(
  assertion,
  algorithm = 'Ed25519',
  options = {}
) {
  const { authenticatorData, clientDataJSON, signature } = assertion

  validateWebAuthnAssertion(assertion)

  const innerAlgorithm = algorithm === 'Ed25519' ? INNER_EDDSA : INNER_ECDSA
  const curve = algorithm === 'Ed25519' ? CURVE_ED25519 : CURVE_P256
  const sigHashAlg = options.signatureHashAlgorithm ?? MULTIHASH_SHA256
  const encInfo = options.encodingInfo ?? PAYLOAD_ENCODING_RAW

  const header = new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION])
  const clientDataLenBytes = varintEncode(clientDataJSON.length)
  const authDataLenBytes = varintEncode(authenticatorData.length)

  return concat([
    header,
    varintEncode(innerAlgorithm),
    varintEncode(curve),
    varintEncode(WEBAUTHN_WRAPPER),
    clientDataLenBytes,
    clientDataJSON,
    authDataLenBytes,
    authenticatorData,
    varintEncode(sigHashAlg),
    varintEncode(encInfo),
    signature,
  ])
}

/**
 * Validate WebAuthn assertion data before encoding.
 *
 * @param {WebAuthnAssertion} assertion
 */
export function validateWebAuthnAssertion(assertion) {
  if (
    !assertion.authenticatorData ||
    assertion.authenticatorData.length === 0
  ) {
    throw new Error('authenticatorData is required and cannot be empty')
  }

  if (!assertion.clientDataJSON || assertion.clientDataJSON.length === 0) {
    throw new Error('clientDataJSON is required and cannot be empty')
  }

  if (!assertion.signature || assertion.signature.length === 0) {
    throw new Error('signature is required and cannot be empty')
  }
}
