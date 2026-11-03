import type { Tagged } from 'type-fest'
import type { JWK } from './jwk-types'
import type { DIDKey } from './key'
import type { DIDPkh } from './pkh'

export type { KeyType, PublicKeyCode, SignatureAlgorithm } from './common'
export * from './jwk-types'

export interface ParsedDID {
  did: string
  didUrl: string
  method: string
  id: string
  params?: Record<string, string>
  path?: string
  query?: string
  fragment?: string
}

export type KeyCapabilitySection =
  | 'authentication'
  | 'assertionMethod'
  | 'keyAgreement'
  | 'capabilityInvocation'
  | 'capabilityDelegation'

export interface Service {
  id: string
  type: string
  serviceEndpoint:
    | string
    | Record<string, unknown>
    | (string | Record<string, unknown>)[]
  [key: string]: unknown
}

export interface DIDResolutionOptions {
  accept?: string
  [key: string]: unknown
}

export interface DIDResolutionResult {
  didDocument: DIDDocument | null
  didResolutionMetadata: {
    contentType?: string
    error?: string
    message?: string
    [key: string]: unknown
  }
  didDocumentMetadata: Record<string, unknown>
}

export interface Resolvable {
  resolve: (
    didUrl: string,
    options?: DIDResolutionOptions
  ) => Promise<DIDResolutionResult>
}

export type DIDResolver = (
  did: string,
  parsed: ParsedDID,
  resolver: Resolvable,
  options: DIDResolutionOptions
) => Promise<DIDResolutionResult>

export type ResolverRegistry = Record<string, DIDResolver>

export interface ResolverOptions {
  cache?: boolean
}

/**
 * DID Types
 */

/**
 * DID string
 */
export type DID = Tagged<`did:${string}:${string}`, 'DID'>

/**
 * DID URL string
 */
export type DIDURL = Tagged<string, 'DIDURL'>

/**
 * Represents a DID URL object.
 */
export interface DIDURLObject extends Omit<ParsedDID, 'params'> {
  /**
   * DID String - top level DID
   * @example "did:web:example.com"
   */
  did: DID
  /**
   * DID URL string
   * @example "did:web:example.com#fragment1?query=value"
   */
  didUrl: DIDURL
}

/**
 * @see https://www.iana.org/assignments/cose/cose.xhtml#algorithms
 * @see https://www.rfc-editor.org/rfc/rfc7518#section-3.1
 */

/**
 * Represents the properties of a Verification Method listed in a DID document.
 *
 * Supported public key representations used by DID verification.
 *
 * @see {@link https://www.w3.org/TR/cid-1.0/#verification-methods}
 */
export type VerificationMethod =
  | MultiKeyMethod
  | JsonWebKeyMethod
  | EcdsaSecp256k1RecoveryMethod2020

/**
 * @see {@link https://www.w3.org/TR/cid-1.0/#dfn-verificationmethod}
 */
export interface VerificationMethodBase {
  id: string
  controller: string
  /**
   * ISO date time string
   * @see {@link https://www.w3.org/TR/xmlschema11-2/#dateTimeStamp}
   * @example "2024-12-10T15:28:32Z"
   */
  expires?: string
  /**
   * ISO date time string
   * @see {@link https://www.w3.org/TR/xmlschema11-2/#dateTimeStamp}
   * @example "2024-12-10T15:28:32Z"
   */
  revoked?: string
}

/**
 * @see https://www.w3.org/TR/cid-1.0/#Multikey
 */
export interface MultiKeyMethod extends VerificationMethodBase {
  type: 'MultiKey' | 'Multikey'
  publicKeyMultibase: string
}

/**
 * @see https://www.w3.org/TR/cid-1.0/#JsonWebKey
 */
export interface JsonWebKeyMethod extends VerificationMethodBase {
  type: 'JsonWebKey2020' | 'JsonWebKey' | 'Ed25519VerificationKey2018'
  publicKeyJwk: JWK
}

/**
 * @see https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/#blockchainAccountId
 */
export interface EcdsaSecp256k1RecoveryMethod2020
  extends VerificationMethodBase {
  type: 'EcdsaSecp256k1RecoveryMethod2020'
  blockchainAccountId: string
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

export interface VerifiableDID extends DIDURLObject {
  /**
   * Verifiable DID - resolved from the {@link did}
   */
  verifiableDid: DIDKey | DIDPkh
  /**
   * DID Document
   */
  document: DIDDocument

  /**
   * DID URL Object
   */
  didObject: DIDURLObject
  /**
   * Returns the DID URL
   */
  toString: () => DIDURL
}

export interface VerifiableDidOptions {
  verifiableDid: DIDKey | DIDPkh
  document: DIDDocument
  didObject: DIDURLObject
}
