import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { DIDURL, ResolveOptions, VerifiableDID } from 'iso-did/types'
import type { ISigner, SignatureType } from 'iso-signatures/types'
import type { Resolver } from 'iso-signatures/verifiers/resolver.js'
import type { CID } from 'multiformats'
import type { Delegation } from './delegation'
import type { Store } from './store'

export type { DIDURL } from 'iso-did/types'

/**
 * Type-safe selector utilities
 */

/**
 * Extracts all possible paths from a data structure as string literals
 */
type PathsToStringProps<T> = T extends
  | string
  | number
  | boolean
  | null
  | undefined
  ? never
  : T extends Array<infer U>
    ?
        | `[]`
        | `[${number}]`
        | `[${number}:${number}]`
        | `[${number}:]`
        | `[:${number}]`
        | `[:]`
        | PathsToStringProps<U>
    : T extends object
      ? {
          [K in keyof T & (string | number)]: K extends string
            ? `.${K}` | `.${K}?` | `.${K}${PathsToStringProps<T[K]>}`
            : `[${K}]` | `[${K}]?` | `[${K}]${PathsToStringProps<T[K]>}`
        }[keyof T & (string | number)]
      : never

/**
 * Flattens nested path strings into a union of all possible selectors
 */
type FlattenPaths<T> = T extends string
  ? T
  : T extends object
    ? {
        [K in keyof T]: T[K] extends string
          ? T[K]
          : T[K] extends object
            ? FlattenPaths<T[K]>
            : never
      }[keyof T]
    : never

/**
 * Type-safe selector that only allows valid paths for the given data structure
 */
export type Selector<Args = unknown> = Args extends unknown
  ? FlattenPaths<PathsToStringProps<Args>> | '.'
  : string

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

/**
 * Envelope types
 */

export type PayloadSpec = 'dlg' | 'inv'
export type PayloadTag = `ucan/${PayloadSpec}@${string}`
export interface PayloadBase {
  /**
   * Issuer DID (sender)
   */
  iss: DIDURL
  /**
   * Audience DID (receiver)
   */
  aud?: DIDURL
  /**
   * Principal that the chain is about (the [Subject])
   */
  sub?: DIDURL | null
  /**
   * The Command to eventually invoke
   * @see https://github.com/ucan-wg/spec#command
   */
  cmd: string
  /**
   * The nonce of the UCAN
   * @see https://github.com/ucan-wg/spec#nonce
   */
  nonce: Uint8Array
  /**
   * Meta (asserted, signed data) — is not delegated authority
   */
  meta?: Record<string, unknown>
  /**
   * Expiration UTC Unix Timestamp in seconds (valid until)
   */
  exp: number | null
  /**
   * "Not before" UTC Unix Timestamp in seconds (valid from)
   */
  nbf?: number
}

/**
 * @see https://github.com/ucan-wg/invocation#invocation-payload
 */
export interface InvocationPayload extends PayloadBase {
  sub: DIDURL
  /**
   * Optional if equal to subject
   */
  aud?: DIDURL

  /**
   * Any [Arguments] that MUST be present in the Invocation
   */
  args: Record<string, unknown>
  /**
   * Delegations that prove the chain of authority
   */
  prf: CID[]
  /**
   * Issued at time
   */
  iat?: number
  /**
   * An OPTIONAL CID of the Receipt that enqueued the Task
   */
  cause?: CID
}

export interface DelegationPayload<Args = unknown> extends PayloadBase {
  aud: DIDURL
  /**
   * Subject can be null here for Powerline
   * @see https://github.com/ucan-wg/delegation/#powerline
   */
  sub: DIDURL | null
  pol: Policy<Args>
}

export type Payload<Args = unknown> =
  | InvocationPayload
  | DelegationPayload<Args>
export type SignaturePayload<Args = unknown> = {
  h: Uint8Array
  [payloadTag: PayloadTag]: Payload<Args>
}

export type Envelope<Args = unknown> = [Uint8Array, SignaturePayload<Args>]

/**
 * @see https://github.com/ucan-wg/spec#envelope
 */
export type EnvelopeEncodeOptions = {
  signature: Uint8Array
  signaturePayload: SignaturePayload
}

export interface EnvelopeSignOptions {
  /**
   * @default '1.0.0'
   */
  version?: string
  /**
   * @default 'DAG-CBOR'
   */
  enc?: VarsigEncoding
  spec: PayloadSpec
  payload: Payload
  signer: ISigner
}

export interface EnvelopeDecodeOptions {
  envelope: Uint8Array
}

export type DecodedEnvelope<Spec extends PayloadSpec> = {
  alg: VarsigAlgorithm
  enc: VarsigEncoding
  signature: Uint8Array
  payload: Spec extends 'dlg' ? DelegationPayload : InvocationPayload
  spec: Spec
  version: string
}

/**
 * Policy types
 * @see https://github.com/ucan-wg/delegation/#policy
 */

/** Connectives */
export type EqualityOp = '==' | '!='
export type Equality<Args = unknown> = [EqualityOp, Selector<Args>, unknown]
export type InequalityOp = '<' | '<=' | '>' | '>='
export type Inequality<Args = unknown> = [InequalityOp, Selector<Args>, number]
export type NegateOp = 'not'
export type Negate<Args = unknown> = [NegateOp, Statement<Args>]
export type ConnectiveOp = 'and' | 'or'
export type Connective<Args = unknown> = [ConnectiveOp, Statement<Args>[]]
export type QuantifierOp = 'all' | 'any'
export type Quantifier<Args = unknown> = [
  QuantifierOp,
  Selector<Args>,
  Statement<Args>,
]
export type LikeOp = 'like'
export type Like<Args = unknown> = [LikeOp, Selector<Args>, string]

export type Statement<Args = unknown> =
  | Equality<Args>
  | Inequality<Args>
  | Negate<Args>
  | Connective<Args>
  | Quantifier<Args>
  | Like<Args>

export type Policy<Args = unknown> = Statement<Args>[]

/**
 * Delegation
 */

export interface DelegationOptions<Args = unknown> {
  iss: ISigner
  aud: VerifiableDID
  sub: VerifiableDID | null
  pol: Policy<Args>
  exp: number | null
  nbf?: number
  nonce?: Uint8Array
  meta?: Record<string, unknown>
}

export interface InvocationOptions {
  iss: ISigner
  aud?: VerifiableDID
  sub: VerifiableDID
  cmd: string
  args: Record<string, unknown>
  /**
   * Proofs of the chain of authority
   */
  prf: Delegation[]
  exp: number | null
  iat?: number
  nbf?: number
  nonce?: Uint8Array
  cause?: CID
  meta?: Record<string, unknown>
}

export interface CapabilityInvokeOptions<Schema extends StandardSchemaV1> {
  iss: ISigner
  aud?: VerifiableDID
  sub: VerifiableDID
  args: StandardSchemaV1.InferOutput<Schema>
  exp: number | null
  iat?: number
  nbf?: number
  nonce?: Uint8Array
  cause?: CID
  meta?: Record<string, unknown>
  store: Store
}

export interface InvocationValidateOptions {
  audience: VerifiableDID
  isRevoked: (cid: CID) => Promise<boolean>
  didResolveOptions?: ResolveOptions
  signatureVerifierResolver: Resolver
  resolveProofs: (proofs: CID[]) => Promise<Delegation[]>
}

export interface DelegationValidateOptions {
  isRevoked: (cid: CID) => Promise<boolean>
  didResolveOptions?: ResolveOptions
  signatureVerifierResolver: Resolver
}

export interface InvocationFromOptions {
  bytes: Uint8Array
  audience: VerifiableDID
  didResolveOptions?: ResolveOptions
  signatureVerifierResolver: Resolver
  isRevoked: (cid: CID) => Promise<boolean>
  resolveProofs: (proofs: CID[]) => Promise<Delegation[]>
}

export interface DelegationFromOptions {
  bytes: Uint8Array
  envelope?: DecodedEnvelope<'dlg'>
  didResolveOptions?: ResolveOptions
  signatureVerifierResolver: Resolver
  isRevoked: (cid: CID) => Promise<boolean>
}

export interface ResolveProofsOptions {
  aud?: DIDURL
  sub: DIDURL | null
  cmd: string
}
