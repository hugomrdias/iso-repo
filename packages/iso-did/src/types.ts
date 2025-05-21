import type {
  KeyCapabilitySection,
  ParsedDID,
  ResolverRegistry,
  Service,
  ResolverOptions as _ResolverOptions,
} from 'did-resolver'
import type { JWK } from './jwk-types'
import type { DIDKey } from './key'
import type { DIDPkh } from './pkh'

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
  id: DIDURL
  controller: DID
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
  type: 'JsonWebKey2020' | 'JsonWebKey'
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

export interface VerifiableDID {
  /**
   * DID String - top level DID
   * @example "did:web:example.com"
   */
  did: DID
  /**
   * DID URL Object - parsed top level DID
   */
  didObject: DIDURLObject
  /**
   * Verifiable DID - resolved from the {@link did}
   */
  verifiableDid: DIDKey | DIDPkh
  /**
   * DID Document
   */
  document: DIDDocument
  /**
   * Returns the DID URL
   */
  toString: () => DIDURL
}
