import type { SignatureAlgorithm } from '../../types.js'

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
