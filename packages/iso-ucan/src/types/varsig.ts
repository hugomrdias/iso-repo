import type { SignatureType } from 'iso-signatures/types'

/**
 * Varsig types
 */

/**
 * Supported encoding types for data to be signed or verified
 */
export type VarsigEncoding = 'RAW' | 'DAG-CBOR'

/**
 * Supported signature types
 *
 * RSA (`RS256`) is not supported.
 */
export type VarsigAlgorithm = Exclude<SignatureType, 'RS256'>

export interface VarsigOptions {
  enc: VarsigEncoding
  alg: VarsigAlgorithm
}

/**
 * Options for varsig `encode`. Accepts any signer type so unsupported
 * algorithms (e.g. `RS256`) fail at runtime with a clear error.
 */
export interface VarsigEncodeOptions {
  enc: VarsigEncoding
  alg: SignatureType
}

export type DecodeOutput = VarsigOptions
