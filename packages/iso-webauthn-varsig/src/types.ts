/**
 * WebAuthn Varsig Types
 *
 * Type definitions for WebAuthn variable signature encoding/decoding.
 */

/**
 * WebAuthn assertion response data.
 */
export interface WebAuthnAssertion {
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  signature: Uint8Array
}

/**
 * Decoded varsig v1 data.
 */
export interface DecodedVarsigV1 {
  algorithm: SignatureAlgorithm
  innerAlgorithm: number
  curve: number
  multihashCode: number
  multihashLength: number
  webauthnMarker: number
  payloadEncoding: number
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
  signature: Uint8Array
}

/**
 * Client data JSON structure from WebAuthn.
 */
export interface ClientDataJSON {
  type: 'webauthn.get' | 'webauthn.create'
  challenge: string
  origin: string
  crossOrigin?: boolean
}

/**
 * Supported signature algorithms.
 */
export type SignatureAlgorithm = 'Ed25519' | 'P-256'

/**
 * Varsig encoding options.
 */
export interface VarsigOptions {
  algorithm: SignatureAlgorithm
}

export interface WebAuthnDecoded {
  authenticatorData: Uint8Array
  clientDataJSON: Uint8Array
}
