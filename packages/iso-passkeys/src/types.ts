export type Base64URLString = string

export interface AuthenticationExtensionsPRFValues {
  first: BufferSource
  second?: BufferSource
}
/**
 * PRF extension inputs
 *
 * @see https://w3c.github.io/webauthn/#dictdef-authenticationextensionsprfinputs
 */
export interface AuthenticationExtensionsPRFInputs {
  /**
   * One or two inputs on which to evaluate PRF. Not all authenticators support evaluating the PRFs during credential creation so outputs may, or may not, be provided. If not, then an assertion is needed in order to obtain the outputs.
   */
  eval: AuthenticationExtensionsPRFValues
  /**
   * A record mapping base64url encoded credential IDs to PRF inputs to evaluate for that credential. Only applicable during assertions when allowCredentials is not empty.
   */
  evalByCredential?: Record<string, AuthenticationExtensionsPRFValues>
}

/**
 * PRF extension outputs
 *
 * @see https://w3c.github.io/webauthn/#dictdef-authenticationextensionsprfoutputs
 */
export interface AuthenticationExtensionsPRFOutputs {
  /**
   * True if, and only if, the one or two PRFs are available for use with the created credential. This is only reported during registration and is not present in the case of authentication.
   */
  enabled?: boolean
  /**
   * The results of evaluating the PRF for the inputs given in eval or evalByCredential. Outputs may not be available during registration;
   */
  results?: AuthenticationExtensionsPRFValues
}

/**
 * LargeBlob extension inputs
 *
 * @see https://w3c.github.io/webauthn/#dictdef-authenticationextensionslargeblobinputs
 */
export interface AuthenticationExtensionsLargeBlobInputs {
  /**
   * Only valid during registration.
   */
  support?: 'required' | 'preferred'
  /**
   * A boolean that indicates that the Relying Party would like to fetch the previously-written blob associated with the asserted credential. Only valid during authentication.
   */
  read?: boolean
  /**
   * An opaque byte string that the Relying Party wishes to store with the existing credential. Only valid during authentication.
   */
  write?: BufferSource
}

/**
 * LargeBlob extension outputs
 *
 * @see https://w3c.github.io/webauthn/#dictdef-authenticationextensionslargebloboutputs
 */
export interface AuthenticationExtensionsLargeBlobOutputs {
  /**
   * True if, and only if, the created credential supports storing large blobs. Only present in registration outputs.
   */
  supported?: boolean
  /**
   * The opaque byte string that was associated with the credential identified by rawId. Only valid if read was true.
   */
  blob?: ArrayBuffer
  /**
   * A boolean that indicates that the contents of write were successfully stored on the authenticator, associated with the specified credential.
   */
  written?: boolean
}

/**
 * Extends the `AuthenticationExtensionsClientInputs` from `lib.dom.d.ts` with LargeBlob  and prf types
 */
export interface AuthenticationExtensionsClientInputs
  extends globalThis.AuthenticationExtensionsClientInputs {
  largeBlob?: AuthenticationExtensionsLargeBlobInputs
  prf?: AuthenticationExtensionsPRFInputs
}

/**
 * Extends the `AuthenticationExtensionsClientOutputs` from `lib.dom.d.ts` with largeBlob and prf types
 */
export interface AuthenticationExtensionsClientOutputs
  extends globalThis.AuthenticationExtensionsClientOutputs {
  largeBlob?: AuthenticationExtensionsLargeBlobOutputs
  prf?: AuthenticationExtensionsPRFOutputs
}

/**
 * PublicKeyCredentialDescriptor encoded as JSON
 *
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialdescriptorjson
 */
export interface PublicKeyCredentialDescriptorJSON {
  id: Base64URLString
  type: PublicKeyCredentialType
  transports?: AuthenticatorTransport[]
}

/**
 * PublicKeyCredentialRequestOptions encoded as JSON
 *
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialrequestoptionsjson
 */
export interface PublicKeyCredentialRequestOptionsJSON {
  challenge: Base64URLString
  timeout?: number
  rpId?: string
  allowCredentials?: PublicKeyCredentialDescriptorJSON[]
  userVerification?: UserVerificationRequirement
  extensions?: AuthenticationExtensionsClientInputs
}

/**
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialuserentityjson
 */
export interface PublicKeyCredentialUserEntityJSON {
  id: Base64URLString
  name: string
  displayName: string
}

/**
 * PublicKeyCredentialCreationOptions as JSON
 *
 * @see https://w3c.github.io/webauthn/#dictdef-publickeycredentialcreationoptionsjson
 */
export interface PublicKeyCredentialCreationOptionsJSON {
  rp: PublicKeyCredentialRpEntity
  user: PublicKeyCredentialUserEntityJSON
  challenge: Base64URLString
  pubKeyCredParams?: PublicKeyCredentialParameters[]
  timeout?: number
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[]
  authenticatorSelection?: AuthenticatorSelectionCriteria
  attestation?: AttestationConveyancePreference
  extensions?: AuthenticationExtensionsClientInputs
}

/**
 * CredentialMediationRequirement
 *
 * Add `conditional` not yet in lib.dom.d.ts
 *
 * https://w3c.github.io/webappsec-credential-management/#mediation-requirements
 */
export type CredentialMediationRequirement =
  | 'optional'
  | 'required'
  | 'silent'
  | 'conditional'

/**
 * Webauthn CredentialRequestOptions
 *
 * Adds `publicKey` option to https://w3c.github.io/webappsec-credential-management/#dictdef-credentialrequestoptions
 *
 * @see https://w3c.github.io/webauthn/#sctn-credentialrequestoptions-extension
 */
export interface CredentialRequestOptions {
  mediation?: CredentialMediationRequirement
  publicKey?: PublicKeyCredentialRequestOptions
  signal?: AbortSignal
}

/**
 * Webauthn CredentialRequestOptions as JSON
 */
export interface CredentialRequestOptionsJSON {
  mediation?: CredentialMediationRequirement
  publicKey?: PublicKeyCredentialRequestOptionsJSON
  signal?: AbortSignal
}

/**
 * Webauthn CredentialCreationOptions as JSON
 */
export interface CredentialCreationOptionsJSON {
  publicKey?: PublicKeyCredentialCreationOptionsJSON
  signal?: AbortSignal
}

export interface AuthenticatorAttestationResponse
  extends globalThis.AuthenticatorAttestationResponse {
  getTransports: () => AuthenticatorTransport[]
}

/**
 * Credential from credentials.create()
 */
export interface RegistrationPublicKeyCredential extends PublicKeyCredential {
  response: AuthenticatorAttestationResponse
  type: PublicKeyCredentialType
  authenticatorAttachment: AuthenticatorAttachment | null
  getClientExtensionResults: () => AuthenticationExtensionsClientOutputs
}

/**
 * Credential from credentials.get()
 */
export interface AuthenticationPublicKeyCredential extends PublicKeyCredential {
  response: AuthenticatorAssertionResponse
  type: PublicKeyCredentialType
  authenticatorAttachment: AuthenticatorAttachment | null
  getClientExtensionResults: () => AuthenticationExtensionsClientOutputs
}

/**
 * Public Key Credentials container
 *
 * Use new types not yet in lib.dom.d.ts
 *
 * @see https://w3c.github.io/webappsec-credential-management/#framework-credential-management
 */
export interface PublicKeyCredentialsContainer extends CredentialsContainer {
  create: (
    options?: CredentialCreationOptions
  ) => Promise<RegistrationPublicKeyCredential | null>
  get: (
    options?: CredentialRequestOptions
  ) => Promise<AuthenticationPublicKeyCredential | null>
  preventSilentAccess: () => Promise<void>
  store: (credential: Credential) => Promise<void>
}

/**
 * A slightly-modified AuthenticatorAttestationResponse to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * https://w3c.github.io/webauthn/#dictdef-authenticatorattestationresponsejson
 */
export interface AuthenticatorAttestationResponseJSON {
  clientDataJSON: Base64URLString
  attestationObject: Base64URLString
  transports?: AuthenticatorTransport[]
}

/**
 * A slightly-modified AuthenticatorAssertionResponse to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * https://w3c.github.io/webauthn/#dictdef-authenticatorassertionresponsejson
 */
export interface AuthenticatorAssertionResponseJSON {
  clientDataJSON: Base64URLString
  authenticatorData: Base64URLString
  signature: Base64URLString
  userHandle?: string
}

/**
 * A slightly-modified AuthenticationCredential to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * https://w3c.github.io/webauthn/#dictdef-authenticationresponsejson
 */
export interface AuthenticationResponseJSON {
  id: Base64URLString
  rawId: Base64URLString
  response: AuthenticatorAssertionResponseJSON
  authenticatorAttachment?: AuthenticatorAttachment | null
  clientExtensionResults: AuthenticationExtensionsClientOutputs
  type: PublicKeyCredentialType
}

/**
 * A slightly-modified RegistrationCredential to simplify working with ArrayBuffers that
 * are Base64URL-encoded in the browser so that they can be sent as JSON to the server.
 *
 * https://w3c.github.io/webauthn/#dictdef-registrationresponsejson
 */
export interface RegistrationResponseJSON {
  id: Base64URLString
  rawId: Base64URLString
  response: AuthenticatorAttestationResponseJSON
  authenticatorAttachment?: AuthenticatorAttachment | null
  clientExtensionResults: AuthenticationExtensionsClientOutputs
  type: PublicKeyCredentialType
}

export type PublicKeyCredentialJSON =
  | RegistrationResponseJSON
  | AuthenticationResponseJSON

/**
 * @see https://w3c.github.io/webauthn/#dictdef-collectedclientdata
 */
export interface CollectedClientData {
  type: string
  challenge: string
  origin: string
  crossOrigin?: boolean
  tokenBinding?: {
    id?: string
    status: 'present' | 'supported' | 'not-supported'
  }
}

export type AttestationFormat =
  | 'fido-u2f'
  | 'packed'
  | 'android-safetynet'
  | 'android-key'
  | 'tpm'
  | 'apple'
  | 'none'

export interface AttestationStatement {
  sig?: Uint8Array
  x5c?: Uint8Array[]
  response?: Uint8Array
  alg?: number
  ver?: string
  certInfo?: Uint8Array
  pubArea?: Uint8Array
}

export interface AuthenticationExtensionsAuthenticatorOutputs {
  devicePubKey?: {
    dpk?: Uint8Array
    sig?: string
    nonce?: Uint8Array
    scope?: Uint8Array
    aaguid?: Uint8Array
  }
  /**
   * @see https://w3c.github.io/webauthn/#sctn-uvm-extension
   */
  uvm?: [number, number, number]
}

/**
 * @see https://w3c.github.io/webauthn/#sctn-authenticator-data
 */
export interface ParsedAuthenticatorData {
  rpIdHash: Uint8Array
  flagsBytes: Uint8Array
  flags: {
    /**
     * User Presence
     */
    up: boolean
    /**
     * User Verified
     */
    uv: boolean
    /**
     * Backup Eligibility
     */
    be: boolean
    /**
     * Backup State
     */
    bs: boolean
    /**
     * Attested Credential Data Present
     */
    at: boolean
    /**
     * Extension Data Present
     */
    ed: boolean
    flagsInt: number
  }
  signCount: number
  signCountBytes: Uint8Array
  aaguid?: Uint8Array
  credentialID?: Uint8Array
  credentialPublicKey?: COSEPublicKey
  credentialPublicKeyBytes: Uint8Array
  extensionsData?: AuthenticationExtensionsAuthenticatorOutputs
  extensionsDataBytes?: Uint8Array
}

export interface AttestationObject {
  fmt: AttestationFormat
  attSmt: AttestationStatement
  authData: ParsedAuthenticatorData
}

// COSE

/**
 * COSE Keys
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#key-common-parameters
 * https://www.iana.org/assignments/cose/cose.xhtml#key-type-parameters
 */
export enum COSEKEYS {
  kty = 1,
  alg = 3,
  crv = -1,
  x = -2,
  y = -3,
  n = -1,
  e = -2,
}

/**
 * COSE Key Types
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#key-type
 */
export enum COSEKTY {
  OKP = 1,
  EC2 = 2,
  RSA = 3,
}

/**
 * COSE Curves
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#elliptic-curves
 */
export enum COSECRV {
  P256 = 1,
  P384 = 2,
  P521 = 3,
  ED25519 = 6,
}

/**
 * COSE Algorithms
 *
 * https://www.iana.org/assignments/cose/cose.xhtml#algorithms
 */
export enum COSEALG {
  ES256 = -7,
  EdDSA = -8,
  ES384 = -35,
  ES512 = -36,
  PS256 = -37,
  PS384 = -38,
  PS512 = -39,
  ES256K = -47,
  RS256 = -257,
  RS384 = -258,
  RS512 = -259,
  RS1 = -65_535,
}

export interface COSEPublicKey {
  1: COSEKTY
  3: COSEALG
}

export interface COSEPublicKeyOKP extends COSEPublicKey {
  '-1': COSECRV
  '-2': Uint8Array
}

export interface COSEPublicKeyEC2 extends COSEPublicKey {
  '-1': COSECRV
  '-2': Uint8Array
  '-3': Uint8Array
}

export interface COSEPublicKeyRSA extends COSEPublicKey {
  '-1': Uint8Array
  '-2': Uint8Array
}
