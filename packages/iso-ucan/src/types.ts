import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Resolver as _DidResolver } from 'iso-did'
import type { DID, DIDURLObject, VerifiableDID } from 'iso-did/types'
import type { ISigner } from 'iso-signatures/types'
import type { Resolver } from 'iso-signatures/verifiers/resolver.js'
import type { CID } from 'multiformats'
import type { Capability } from './capability'
import type { Delegation } from './delegation'
import type { Invocation } from './invocation'
import type { Store } from './store'
import type { Policy } from './types/policy'

export type { StandardSchemaV1 } from '@standard-schema/spec'
export type { DID, DIDURL, DIDURLObject } from 'iso-did/types'
export type { ISigner } from 'iso-signatures/types'
export * from './rpc/types'
export * from './types/envelope'
export * from './types/policy'
export * from './types/varsig'

export type ResolveProof = (proof: CID) => Promise<Delegation>
/**
 * Check whether a delegation CID is revoked.
 *
 * Called once for each CID the delegation could have been issued under
 * (up to 2 for ECDSA and 4 for EIP-191 signatures), since those signatures
 * can be re-encoded into another valid signature with a different CID.
 */
export type IsRevoked = (cid: CID) => Promise<boolean>
export type VerifierResolver = Resolver
export type DidResolver = _DidResolver

export type CborPrimitive =
  | string
  | number
  | boolean
  | null
  | bigint
  | Uint8Array
  | ArrayBuffer
export type CborArray = CborValue[] | readonly CborValue[]
export type CborObject =
  | { [Key in string]: CborValue }
  | { [Key in string]?: CborValue | undefined }

export type CborValue = CborPrimitive | CborArray | CborObject

/**
 * Delegation
 */

export interface DelegationOptions<Schema extends StandardSchemaV1> {
  iss: ISigner
  aud: DID
  sub: DID | null
  pol: Policy<StandardSchemaV1.InferOutput<Schema>>
  /**
   * Expiration time in seconds or null for no expiration
   */
  exp?: number | null
  /**
   * Time to live in seconds, expiration thats precedence over ttl
   * @default 300
   */
  ttl?: number
  /**
   * Not before time in seconds
   * Delegation is not valid before this time
   */
  nbf?: number
  nonce?: Uint8Array
  cmd: string
  meta?: CborObject
  /**
   * The current time in seconds. Mostly used for testing.
   * @default Math.floor(Date.now() / 1000)
   */
  now?: number
}

export interface DelegationValidateOptions {
  isRevoked?: IsRevoked
  didResolver?: DidResolver
  verifierResolver: VerifierResolver
  /**
   * The current time in seconds. Mostly used for testing.
   * @default Math.floor(Date.now() / 1000)
   */
  now?: number
}

export interface DelegationFromOptions extends DelegationValidateOptions {
  bytes: Uint8Array
}

/**
 * Invocation
 */

/**
 * Invocation options
 */
export interface InvocationOptions extends DelegationValidateOptions {
  iss: ISigner
  aud?: DID
  sub: DID
  cmd: string
  args: CborObject
  /**
   * Proofs of the chain of authority
   */
  prf: Delegation[]
  /**
   * Expiration time in seconds or null for no expiration
   */
  exp?: number | null
  /**
   * Time to live in seconds, expiration thats precedence over ttl
   * @default 300
   */
  ttl?: number
  /**
   * Issued at time in seconds
   */
  iat?: number
  nbf?: number
  nonce?: Uint8Array
  cause?: CID
  meta?: CborObject
}

export interface InvocationFromOptions extends DelegationValidateOptions {
  bytes: Uint8Array
  audience?: VerifiableDID
  resolveProof: ResolveProof
  /**
   * Store of seen invocations. When set, an invocation whose signed payload was
   * already seen is rejected. Checked after all other validation passes.
   *
   * Executors MUST use one to prevent replay attacks.
   */
  replayStore?: ReplayStore
  /**
   * Maximum lifetime in seconds accepted for the invocation. When set,
   * invocations without an expiration, or expiring more than `maxTtl` seconds
   * after `now`, are rejected. This keeps the replay store bounded.
   */
  maxTtl?: number
}

/**
 * Store of seen invocations, used to reject replays.
 */
export interface ReplayStore {
  /**
   * Atomically record `key` and resolve `true`, or resolve `false` if `key`
   * was already recorded and has not expired.
   *
   * @param key - Replay key of the invocation, see {@link Invocation.replayKey}
   * @param expiration - Unix time in seconds after which the key can be forgotten, or `null` to keep it forever
   */
  checkAndSet(key: string, expiration: number | null): Promise<boolean>
}

/**
 * Capability types
 */

/**
 * Capability options
 */
export interface CapabilityOptions<
  Schema extends StandardSchemaV1,
  Cmd extends string = string,
> {
  schema: Schema
  cmd: Cmd
}

/**
 * Delegate a capability
 */
export interface CapabilityDelegateOptions<Schema extends StandardSchemaV1>
  extends Omit<DelegationOptions<Schema>, 'cmd'> {
  /**
   * Store to add the delegation to
   */
  store: Store
}

/**
 * Invoke a capability
 */
export interface CapabilityInvokeOptions<Schema extends StandardSchemaV1>
  extends Omit<InvocationOptions, 'cmd' | 'args' | 'prf'> {
  args: StandardSchemaV1.InferOutput<Schema>
  /**
   * Store to resolve proofs from
   */
  store: Store
}

/**
 * Store types
 */

/**
 * Resolve proofs options
 */
export interface StoreProofsOptions {
  aud?: DID
  sub: DID | null
  cmd: string
  args: CborObject
}

/**
 * Server types
 */
export type Promisable<T> = T | PromiseLike<T>

export interface HandlerOptions<Schema extends StandardSchemaV1> {
  args: StandardSchemaV1.InferOutput<Schema>
  store: Store
}

export type Handler<Schema extends StandardSchemaV1, Output> = (
  options: HandlerOptions<Schema>
) => Promisable<Output>

export interface RouteOptions<
  Cap extends Capability<StandardSchemaV1>,
  Output,
> {
  capability: Cap
  handler: Handler<Cap['schema'], Output>
}

export type RouteOutput<Cap extends Capability<StandardSchemaV1>, Output> = {
  cap: Cap
  fn: (options: RouteHandlerOptions) => Promisable<Output>
}

/**
 * Infer the protocol from a router
 */
export type InferProtocol<
  Routes extends Record<
    string,
    RouteOutput<Capability<StandardSchemaV1>, unknown>
  >,
> = {
  [K in keyof Routes]: Routes[K] extends RouteOutput<infer Cap, infer Output>
    ? {
        cmd: Cap['cmd'] extends K ? Cap['cmd'] : never
        in: StandardSchemaV1.InferOutput<Cap['schema']>
        out: Output
      }
    : never
}[keyof Routes]

export type Protocol<
  Cap extends Capability<StandardSchemaV1> = Capability<StandardSchemaV1>,
> = {
  cmd: Cap['cmd']
  in: StandardSchemaV1.InferOutput<Cap['schema']>
  out: unknown
}[]

/**
 * Creates a router type that validates:
 * 1. Router keys match capability commands
 * 2. Router values are RouteOutput types that match the capability
 */
export type Router<Caps extends readonly Capability<StandardSchemaV1>[]> = {
  [K in Caps[number]['cmd']]: Caps extends readonly (infer Cap)[]
    ? Cap extends Capability<StandardSchemaV1>
      ? Cap['cmd'] extends K
        ? RouteOutput<Cap, unknown>
        : never
      : never
    : never
}

export interface RouteHandlerOptions {
  request: Request
  issuer: ISigner
  invocation: Invocation
  store: Store
}

/**
 * Client type that provides type-safe request methods based on router inference
 */
export type RouterClient<
  Router extends InferProtocol<
    Record<string, RouteOutput<Capability<StandardSchemaV1>, unknown>>
  >,
> = {
  request<Cmd extends Router['cmd']>(
    cmd: Cmd,
    args: Extract<Router, { cmd: Cmd }>['in']
  ): Promise<Extract<Router, { cmd: Cmd }>['out']>
}

export type ClientOptions = {
  url: string
  issuer: ISigner
  audience: DIDURLObject
  store: Store
  capabilities: Capability<StandardSchemaV1, string>[]
  verifierResolver: VerifierResolver
  /**
   * Time to live in seconds of the invocations created by the client
   * @default 300
   */
  ttl?: number
}
