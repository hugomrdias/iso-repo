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
 */
export type VarsigAlgorithm = SignatureType

export interface VarsigOptions {
  enc: VarsigEncoding
  alg: VarsigAlgorithm
}

export type DecodeOutput = VarsigOptions
