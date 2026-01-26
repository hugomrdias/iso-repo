type WebAuthnVarsigCredential = {
  credentialId: Uint8Array
  publicKey: Uint8Array
  did: string
  algorithm: 'Ed25519' | 'P-256'
  cose?: { kty?: number; alg?: number; crv?: number } | null
}

declare module '@le-space/orbitdb-identity-provider-webauthn-did/src/varsig/credential.js' {
  export function createWebAuthnVarsigCredential(options?: {
    userId?: string
    displayName?: string
    domain?: string
  }): Promise<WebAuthnVarsigCredential>
}

declare module '@le-space/orbitdb-identity-provider-webauthn-did/src/varsig/storage.js' {
  export function storeWebAuthnVarsigCredential(
    credential: WebAuthnVarsigCredential,
    key?: string
  ): void
  export function loadWebAuthnVarsigCredential(
    key?: string
  ): WebAuthnVarsigCredential | null
}

declare module '@le-space/orbitdb-identity-provider-webauthn-did/src/varsig/assertion.js' {
  export function runWebAuthnAssertionForPayload(
    credential: WebAuthnVarsigCredential,
    payloadBytes: Uint8Array,
    domainLabel: string
  ): Promise<{
    rpId: string
    origin: string
    challengeBytes: Uint8Array
    algorithm: 'Ed25519' | 'P-256'
    publicKey: Uint8Array
    assertion: {
      authenticatorData: Uint8Array
      clientDataJSON: Uint8Array
      signature: Uint8Array
    }
  }>
  export function buildVarsigOutput(assertionData: unknown): Promise<{
    varsig: Uint8Array
    clientData: unknown
    verification: { valid: boolean }
    signatureValid: boolean
  }>
  export function verifyVarsigForPayload(
    signature: Uint8Array,
    publicKey: Uint8Array,
    payloadBytes: Uint8Array,
    domainLabel: string
  ): Promise<boolean>
  export function toBytes(data: Uint8Array | string): Uint8Array
}
