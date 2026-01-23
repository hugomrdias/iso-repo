import {
  VARSIG_PREFIX,
  VARSIG_VERSION,
  INNER_EDDSA,
  INNER_ECDSA,
  CURVE_ED25519,
  CURVE_P256,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  PAYLOAD_ENCODING_RAW,
  WEBAUTHN_WRAPPER,
} from './multicodec.js'
import { concat, varintEncode } from './utils.js'

/**
 * @typedef {import('./types').WebAuthnAssertion} WebAuthnAssertion
 * @typedef {import('./types').SignatureAlgorithm} SignatureAlgorithm
 */

/**
 * Encode a WebAuthn assertion as varsig v1.
 *
 * Format:
 * - varsig prefix (0x34)
 * - varsig version (0x01)
 * - signature algorithm metadata (varints)
 * - payload encoding metadata (varint)
 * - assertion serialization
 *
 * @param {WebAuthnAssertion} assertion
 * @param {SignatureAlgorithm} [algorithm]
 */
export function encodeWebAuthnVarsigV1(assertion, algorithm = 'Ed25519') {
  const { authenticatorData, clientDataJSON, signature } = assertion

  validateWebAuthnAssertion(assertion)

  const innerAlgorithm = algorithm === 'Ed25519' ? INNER_EDDSA : INNER_ECDSA
  const curve = algorithm === 'Ed25519' ? CURVE_ED25519 : CURVE_P256

  const header = new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION])
  const authDataLenBytes = varintEncode(authenticatorData.length)
  const clientDataLenBytes = varintEncode(clientDataJSON.length)

  return concat([
    header,
    varintEncode(innerAlgorithm),
    varintEncode(curve),
    varintEncode(MULTIHASH_SHA256),
    varintEncode(MULTIHASH_SHA256_LEN),
    varintEncode(WEBAUTHN_WRAPPER),
    varintEncode(PAYLOAD_ENCODING_RAW),
    authDataLenBytes,
    authenticatorData,
    clientDataLenBytes,
    clientDataJSON,
    signature,
  ])
}

/**
 * Validate WebAuthn assertion data before encoding.
 *
 * @param {WebAuthnAssertion} assertion
 */
export function validateWebAuthnAssertion(assertion) {
  if (!assertion.authenticatorData || assertion.authenticatorData.length === 0) {
    throw new Error('authenticatorData is required and cannot be empty')
  }

  if (!assertion.clientDataJSON || assertion.clientDataJSON.length === 0) {
    throw new Error('clientDataJSON is required and cannot be empty')
  }

  if (!assertion.signature || assertion.signature.length === 0) {
    throw new Error('signature is required and cannot be empty')
  }
}
