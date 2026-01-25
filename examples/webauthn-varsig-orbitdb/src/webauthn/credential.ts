import { DIDKey } from 'iso-did'
import { parseAttestationObject } from 'iso-passkeys'
import { base64urlToBytes, bytesToBase64url } from 'iso-webauthn-varsig'

const STORAGE_KEY = 'webauthn-varsig-demo-credential'
const STORAGE_KEY_PUBLIC = 'webauthn-varsig-demo-public-key'
const STORAGE_KEY_DID = 'webauthn-varsig-demo-did'
const STORAGE_KEY_META = 'webauthn-varsig-demo-meta'

type StoredCredential = {
  credentialId: Uint8Array
  publicKey: Uint8Array
  did: string
  cose: { kty?: number; alg?: number; crv?: number }
  algorithm: 'Ed25519' | 'P-256'
}

function extractCredentialInfo(attestationObject: Uint8Array): {
  algorithm: 'Ed25519' | 'P-256' | null
  publicKey: Uint8Array | null
  kty?: number
  alg?: number
  crv?: number
} {
  const parsed = parseAttestationObject(attestationObject.buffer)
  const coseKey = parsed.authData.credentialPublicKey

  if (!coseKey) {
    throw new Error('Credential public key missing from attestation')
  }

  const getValue = (key: number): unknown =>
    coseKey instanceof Map
      ? coseKey.get(key)
      : (coseKey as unknown as Record<number, unknown>)[key]

  const kty = getValue(1) as number | undefined
  const alg = getValue(3) as number | undefined
  const crv = getValue(-1) as number | undefined

  if (kty === 1 && (alg === -50 || alg === -8) && crv === 6) {
    const publicKeyBytes = new Uint8Array(getValue(-2) as ArrayBufferLike)
    if (publicKeyBytes.length !== 32) {
      throw new Error(
        `Invalid Ed25519 public key length: ${publicKeyBytes.length}`
      )
    }

    return { algorithm: 'Ed25519', publicKey: publicKeyBytes, kty, alg, crv }
  }

  if (kty === 2 && alg === -7 && crv === 1) {
    const x = new Uint8Array(getValue(-2) as ArrayBufferLike)
    const y = new Uint8Array(getValue(-3) as ArrayBufferLike)
    if (x.length !== 32 || y.length !== 32) {
      throw new Error(
        `Invalid P-256 coordinate length: x=${x.length} y=${y.length}`
      )
    }

    const publicKeyBytes = new Uint8Array(65)
    publicKeyBytes[0] = 0x04
    publicKeyBytes.set(x, 1)
    publicKeyBytes.set(y, 33)
    return { algorithm: 'P-256', publicKey: publicKeyBytes, kty, alg, crv }
  }

  return { algorithm: null, publicKey: null, kty, alg, crv }
}

export function loadStoredCredential(): StoredCredential | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  const storedPublicKey = localStorage.getItem(STORAGE_KEY_PUBLIC)
  const storedDid = localStorage.getItem(STORAGE_KEY_DID)
  const storedMeta = localStorage.getItem(STORAGE_KEY_META)
  if (stored && storedPublicKey && storedDid && storedMeta) {
    const meta = JSON.parse(storedMeta) as {
      algorithm: 'Ed25519' | 'P-256'
      kty?: number
      alg?: number
      crv?: number
    }
    return {
      credentialId: base64urlToBytes(stored),
      publicKey: base64urlToBytes(storedPublicKey),
      did: storedDid,
      cose: { kty: meta.kty, alg: meta.alg, crv: meta.crv },
      algorithm: meta.algorithm,
    }
  }
  return null
}

export async function registerCredential(): Promise<StoredCredential> {
  const cached = loadStoredCredential()
  if (cached) {
    return cached
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    rp: { name: 'iso-webauthn-varsig', id: window.location.hostname },
    user: {
      id: crypto.getRandomValues(new Uint8Array(16)),
      name: 'demo@example.com',
      displayName: 'Varsig Demo',
    },
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    pubKeyCredParams: [
      { type: 'public-key', alg: -50 },
      { type: 'public-key', alg: -8 },
      { type: 'public-key', alg: -7 },
    ],
    attestation: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  }

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null

  if (!credential) {
    throw new Error('Passkey registration failed.')
  }

  const response = credential.response as AuthenticatorAttestationResponse
  const {
    algorithm,
    publicKey: publicKeyBytes,
    kty,
    alg,
    crv,
  } = extractCredentialInfo(new Uint8Array(response.attestationObject))

  if (!publicKeyBytes || !algorithm) {
    throw new Error(
      'No supported credential returned (expected Ed25519 or P-256)'
    )
  }

  const rawId = new Uint8Array(credential.rawId)
  const encoded = bytesToBase64url(rawId)
  const encodedPublicKey = bytesToBase64url(publicKeyBytes)
  const did = DIDKey.fromPublicKey(algorithm, publicKeyBytes).did
  localStorage.setItem(STORAGE_KEY, encoded)
  localStorage.setItem(STORAGE_KEY_PUBLIC, encodedPublicKey)
  localStorage.setItem(STORAGE_KEY_DID, did)
  localStorage.setItem(
    STORAGE_KEY_META,
    JSON.stringify({ algorithm, kty, alg, crv })
  )
  return {
    credentialId: rawId,
    publicKey: publicKeyBytes,
    did,
    cose: { kty, alg, crv },
    algorithm,
  }
}

export type { StoredCredential }
