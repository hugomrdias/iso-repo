import { createWebAuthnVarsigCredential } from '@le-space/orbitdb-identity-provider-webauthn-did/src/varsig/credential.js'
import {
  loadWebAuthnVarsigCredential,
  storeWebAuthnVarsigCredential,
} from '@le-space/orbitdb-identity-provider-webauthn-did/src/varsig/storage.js'

const STORAGE_KEY = 'webauthn-varsig-demo-credential'

type StoredCredential = {
  credentialId: Uint8Array
  publicKey: Uint8Array
  did: string
  cose: { kty?: number; alg?: number; crv?: number }
  algorithm: 'Ed25519' | 'P-256'
}

export function loadStoredCredential(): StoredCredential | null {
  return loadWebAuthnVarsigCredential(STORAGE_KEY) as StoredCredential | null
}

export async function registerCredential(): Promise<StoredCredential> {
  const cached = loadStoredCredential()
  if (cached) {
    return cached
  }

  const credential = (await createWebAuthnVarsigCredential({
    userId: 'demo@example.com',
    displayName: 'Varsig Demo',
    domain: window.location.hostname,
  })) as StoredCredential

  storeWebAuthnVarsigCredential(credential, STORAGE_KEY)
  return credential
}

export type { StoredCredential }
