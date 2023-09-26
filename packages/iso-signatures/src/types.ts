import type { DIDKey } from 'iso-did/key'
import type { KeyType, SignatureAlgorithm } from 'iso-did/types'

export interface ISigner<Export extends CryptoKeyPair | string> {
  /**
   * JWT signing algorithm
   */
  alg: SignatureAlgorithm
  /**
   * Keypair type
   */
  type: KeyType
  /**
   * Multicodec identifier for the private key
   */
  code?: number

  did: DIDKey
  /**
   * Sign a message
   */
  sign: (message: Uint8Array) => Promise<Uint8Array>

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

export interface PublicKeyJwk {
  kty: string
  crv: string
  x: string
  y: string
}

export interface PublicKeyRSAJwk {
  kty: string
  n: string
  e: string
}

export interface PrivateKeyRSAJwk extends PublicKeyRSAJwk {
  d: string
  p: string
  q: string
  dp: string
  dq: string
  qi: string
}

export type PrivateKeyJwk = PublicKeyJwk & { d: string }
