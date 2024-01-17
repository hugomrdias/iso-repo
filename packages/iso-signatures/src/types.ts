import type { SignatureAlgorithm, VerifiableDID } from 'iso-did/types'

export interface Sign {
  sign: (message: Uint8Array) => Promise<Uint8Array>
}

export interface ISigner<Export extends CryptoKeyPair | string>
  extends VerifiableDID,
    Sign {
  code?: number
  export: () => Export
}

export interface VerifyInput {
  signature: Uint8Array
  message: Uint8Array
  publicKey: Uint8Array
}
export type Verify = (input: VerifyInput) => Promise<boolean>

export type Verifier<T extends SignatureAlgorithm> = Record<T, Verify>

export type VerifierRegistry<T extends SignatureAlgorithm> = Partial<
  Verifier<T>
>

export interface ResolverVerifyInput extends VerifyInput {
  alg: SignatureAlgorithm
}
export type Cache = (parsed: VerifyInput, verify: Verify) => Promise<boolean>

export interface IResolver {
  verify: (input: ResolverVerifyInput) => Promise<boolean>
}

export interface ResolverOptions {
  cache?: Cache | boolean | undefined
}
