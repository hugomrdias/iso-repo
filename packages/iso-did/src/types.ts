import type {
  KeyCapabilitySection,
  ParsedDID,
  ResolverRegistry,
  Service,
  ResolverOptions as _ResolverOptions,
} from 'did-resolver'
import type { KeyType, SignatureAlgorithm } from './common'
import type { JWK } from './jwk-types'

export type { KeyType, PublicKeyCode, SignatureAlgorithm } from './common'

export * from './jwk-types'

export interface ResolveOptions {
  resolvers?: ResolverRegistry
  cache?: _ResolverOptions['cache']
}

/**
 * DID Types
 */

/**
 * Represents a DID URL object.
 */
export interface DIDURLObject extends Omit<ParsedDID, 'params'> {
  did: DID
}
export type DID = `did:${string}:${string}`
export type DIDURL = string

/**
 * @see https://www.iana.org/assignments/cose/cose.xhtml#algorithms
 * @see https://www.rfc-editor.org/rfc/rfc7518#section-3.1
 */

/**
 * Represents the properties of a Verification Method listed in a DID document.
 *
 * This data type includes public key representations that are no longer present in the spec but are still used by
 * several DID methods / resolvers and kept for backward compatibility.
 *
 * @see {@link https://www.w3.org/TR/did-core/#verification-methods}
 * @see {@link https://www.w3.org/TR/did-core/#verification-method-properties}
 */
export type VerificationMethod = MultiKeyMethod | JsonWebKey2020Method

/**
 * @see https://www.w3.org/TR/vc-data-integrity/#multikey
 */
export interface MultiKeyMethod {
  id: DIDURL
  type: 'MultiKey'
  controller: DID
  publicKeyMultibase: string
}

export interface JsonWebKey2020Method {
  /**
   * The hash fragment should be the `kid` of the JWK.
   */
  id: DIDURL
  type: 'JsonWebKey2020'
  controller: DID
  publicKeyJwk: JWK
}

/**
 * Represents a DID document.
 *
 * @see {@link https://www.w3.org/TR/did-core/#did-document-properties}
 */
export type DIDDocument = {
  '@context'?: 'https://www.w3.org/ns/did/v1' | string | string[]
  id: string
  alsoKnownAs?: string[]
  controller?: string | string[]
  verificationMethod?: VerificationMethod[]
  service?: Service[]
} & {
  [x in KeyCapabilitySection]?: Array<string | VerificationMethod>
}

export interface VerifiableDID {
  did: DID
  url: DIDURLObject
  /**
   * Keypair type
   */
  type: KeyType
  publicKey: Uint8Array
  /**
   * JWT signing algorithm
   */
  alg: SignatureAlgorithm
  document: DIDDocument
  toString: () => DIDURL
}
