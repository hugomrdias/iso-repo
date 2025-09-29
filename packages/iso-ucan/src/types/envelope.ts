import type { DID, DIDURL } from 'iso-did/types'
import type { ISigner } from 'iso-signatures/types'
import type { CID } from 'multiformats'
import type { Policy } from './policy'
import type { VarsigAlgorithm, VarsigEncoding } from './varsig'

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
  aud?: DID
  /**
   * Principal that the chain is about (the [Subject])
   */
  sub?: DID | null
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
  sub: DID
  /**
   * Optional if equal to subject
   */
  aud?: DID

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
  aud: DID
  /**
   * Subject can be null here for Powerline
   * @see https://github.com/ucan-wg/delegation/#powerline
   */
  sub: DID | null
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
