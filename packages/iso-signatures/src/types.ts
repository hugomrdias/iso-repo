import type { VerifiableDID } from 'iso-did/types'

export type SignatureType =
  | 'Ed25519'
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'ES256K'
  | 'RS256'
  | 'EIP191'

export interface Sign {
  sign: (message: Uint8Array) => Promise<Uint8Array>
}

export interface ISigner<Export extends CryptoKeyPair | string = string>
  extends VerifiableDID,
    Sign {
  export: () => Export
  signatureType: SignatureType
}

export interface VerifyInput {
  signature: Uint8Array
  message: Uint8Array
  did: VerifiableDID
  /**
   * Only accept the canonical signature encoding. ECDSA (P-256/384/521) and
   * EIP-191 signatures with a high S value (`s > n/2`) are rejected, and
   * EIP-191 signatures must use 27/28 as the recovery byte.
   *
   * Other signature types ignore this option.
   *
   * @default false
   */
  strict?: boolean
}
export type Verify = (input: VerifyInput) => Promise<boolean>

export type Verifier<T extends SignatureType> = Record<T, Verify>

export type VerifierRegistry<T extends SignatureType> = Partial<Verifier<T>>

export interface ResolverVerifyInput extends VerifyInput {
  /**
   * The type of signature to verify
   */
  type: SignatureType
}
export type Cache = (parsed: VerifyInput, verify: Verify) => Promise<boolean>

export interface IResolver {
  verify: (input: ResolverVerifyInput) => Promise<boolean>
}

export interface ResolverOptions {
  cache?: Cache | boolean | undefined
  /**
   * Default `strict` value for verify calls that don't set it.
   *
   * Only enable this when you control all signers: other implementations
   * produce high S ECDSA signatures and 0/1 EIP-191 recovery bytes.
   *
   * @see {@link VerifyInput.strict}
   * @default false
   */
  strict?: boolean
}
