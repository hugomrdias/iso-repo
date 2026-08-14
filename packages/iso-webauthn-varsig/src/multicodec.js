/**
 * Multicodec Constants for WebAuthn Varsig.
 *
 * These multicodec prefixes identify the signature format in the varsig.
 * WebAuthn signatures are not raw Ed25519/P-256 signatures, so they need a
 * discriminant specific to WebAuthn.
 *
 * Reference: https://github.com/ChainAgnostic/varsig#signature-algorithm
 */

/**
 * Standard Ed25519 public key (multicodec table).
 */
export const ED25519_PUB = 0xed

/**
 * WebAuthn-wrapped Ed25519 signature (varsig discriminant).
 */
export const WEBAUTHN_ED25519 = 0xd1ed

/**
 * WebAuthn-wrapped P-256 signature (varsig discriminant).
 */
export const WEBAUTHN_P256 = 0xd1f2

/**
 * Standard P-256 public key (multicodec table).
 */
export const P256_PUB = 0x1200

/**
 * Varsig v1 header.
 */
export const VARSIG_PREFIX = 0x34
export const VARSIG_VERSION = 0x01

/**
 * Varsig signature algorithm discriminants.
 */
export const INNER_EDDSA = 0xed
export const INNER_ECDSA = 0xec

/**
 * Varsig curve codes (multicodec).
 *
 * These are multicodec *codes*; they are varint-encoded when written. 0xed
 * encodes to the bytes `ed 01`, which is why ed25519-pub is often written
 * "0xed01" in prose — but using that as the code here means the number 60673,
 * whose varint is `81 da 03`, and no other implementation would read it as
 * ed25519-pub. Alias the codes declared above so the two cannot drift.
 */
export const CURVE_ED25519 = ED25519_PUB
export const CURVE_P256 = P256_PUB

/**
 * Varsig multihash header (SHA-256).
 */
export const MULTIHASH_SHA256 = 0x12
export const MULTIHASH_SHA256_LEN = 0x20

/**
 * Varsig payload encoding metadata.
 */
export const PAYLOAD_ENCODING_RAW = 0x5f

/**
 * WebAuthn extension marker (private-use multicodec range).
 */
export const WEBAUTHN_WRAPPER = 0x300001

/**
 * Map of algorithm names to multicodecs.
 */
/** @type {Record<'Ed25519' | 'P-256', number>} */
export const ALGORITHM_TO_MULTICODEC = {
  Ed25519: WEBAUTHN_ED25519,
  'P-256': WEBAUTHN_P256,
}

/**
 * Map of multicodecs to algorithm names.
 */
/** @type {Record<number, 'Ed25519' | 'P-256'>} */
export const MULTICODEC_TO_ALGORITHM = {
  [WEBAUTHN_ED25519]: 'Ed25519',
  [WEBAUTHN_P256]: 'P-256',
}

/**
 * Check if a multicodec represents a WebAuthn signature.
 *
 * @param {number} multicodec
 */
export function isWebAuthnMulticodec(multicodec) {
  return multicodec === WEBAUTHN_ED25519 || multicodec === WEBAUTHN_P256
}

/**
 * Get algorithm name from multicodec.
 *
 * @param {number} multicodec
 * @returns {'Ed25519' | 'P-256' | null}
 */
export function getAlgorithm(multicodec) {
  return MULTICODEC_TO_ALGORITHM[multicodec] ?? null
}
