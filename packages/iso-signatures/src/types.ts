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

export interface ISigner<Export extends CryptoKeyPair | string>
  extends VerifiableDID,
    Sign {
  export: () => Export
  signatureType: SignatureType
}

export interface VerifyInput {
  signature: Uint8Array
  message: Uint8Array
  did: VerifiableDID
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
}
