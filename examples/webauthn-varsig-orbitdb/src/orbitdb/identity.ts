import { base64urlToBytes, bytesToBase64url, concat } from 'iso-webauthn-varsig'
import * as Block from 'multiformats/block'
import * as dagCbor from '@ipld/dag-cbor'
import { sha256 } from 'multiformats/hashes/sha2'
import { base58btc } from 'multiformats/bases/base58'
import { registerCredential, loadStoredCredential } from '../webauthn/credential'
import {
  buildVarsigOutput,
  runWebAuthnAssertionForPayload,
  toBytes,
  verifyVarsigForPayload,
} from '../webauthn/varsig'

const STORAGE_KEY_ORBITDB_IDENTITY = 'webauthn-varsig-orbitdb-identity'
const encoder = new TextEncoder()

const IDENTITY_CODEC = dagCbor
const IDENTITY_HASHER = sha256
const IDENTITY_HASH_ENCODING = base58btc

export type OrbitDbIdentity = {
  id: string
  did: string
  publicKey: Uint8Array
  algorithm: 'Ed25519' | 'P-256'
  signatures: {
    id: Uint8Array
    publicKey: Uint8Array
  }
}

export type WebAuthnOrbitIdentity = {
  id: string
  publicKey: Uint8Array
  signatures: { id: Uint8Array; publicKey: Uint8Array }
  type: string
  sign: (identity: unknown, data: Uint8Array | string) => Promise<Uint8Array>
  verify: (
    signature: Uint8Array,
    publicKey: Uint8Array,
    data: Uint8Array | string
  ) => Promise<boolean>
  hash: string
  bytes: Uint8Array
}

export type WebAuthnIdentities = {
  verify: (signature: Uint8Array, publicKey: Uint8Array, data: Uint8Array) => Promise<boolean>
  verifyIdentity: (identity: WebAuthnOrbitIdentity) => Promise<boolean>
  getIdentity: (hash: string) => Promise<WebAuthnOrbitIdentity | null>
  addIdentity: (identity: WebAuthnOrbitIdentity) => void
}

export type IdentityStorage = {
  get: (hash: string) => Promise<Uint8Array | undefined>
  put: (hash: string, bytes: Uint8Array) => Promise<void>
}

export type IdentityPayload = {
  id: string
  publicKey: string
  signatures: { id: string; publicKey: string }
  type: string
  hash: string
  bytes: string
}

async function decodeIdentityFromBytes(bytes: Uint8Array): Promise<WebAuthnOrbitIdentity> {
  const { value } = await Block.decode({
    bytes,
    codec: IDENTITY_CODEC,
    hasher: IDENTITY_HASHER,
  })
  const decoded = value as {
    id: string
    publicKey: Uint8Array
    signatures: { id: Uint8Array; publicKey: Uint8Array }
    type: string
  }
  const { hash } = await encodeIdentityValue({
    id: decoded.id,
    publicKey: decoded.publicKey,
    signatures: decoded.signatures,
    type: decoded.type,
  })
  return {
    id: decoded.id,
    publicKey: decoded.publicKey,
    signatures: decoded.signatures,
    type: decoded.type,
    hash,
    bytes,
    sign: async () => {
      throw new Error('Remote identity cannot sign')
    },
    verify: async (signature, publicKey, data) =>
      verifyVarsigForPayload(signature, publicKey, data, 'orbitdb-entry:'),
  }
}

function createWebAuthnIdentities(
  identity: WebAuthnOrbitIdentity,
  storage?: IdentityStorage
): WebAuthnIdentities {
  const identityByHash = new Map([[identity.hash, identity]])
  if (storage) {
    void storage.put(identity.hash, identity.bytes)
  }

  const verify = async (
    signature: Uint8Array,
    publicKey: Uint8Array,
    data: Uint8Array
  ) => verifyVarsigForPayload(signature, publicKey, data, 'orbitdb-entry:')

  const verifyIdentity = async (identityToVerify: WebAuthnOrbitIdentity) => {
    if (!identityToVerify) return false
    const idBytes = encoder.encode(identityToVerify.id)
    const idValid = await verifyVarsigForPayload(
      identityToVerify.signatures.id,
      identityToVerify.publicKey,
      idBytes,
      'orbitdb-id:'
    )
    if (!idValid) return false
    const pubKeyPayload = concat([
      identityToVerify.publicKey,
      identityToVerify.signatures.id,
    ])
    return verifyVarsigForPayload(
      identityToVerify.signatures.publicKey,
      identityToVerify.publicKey,
      pubKeyPayload,
      'orbitdb-pubkey:'
    )
  }

  const getIdentity = async (hash: string) => {
    const cached = identityByHash.get(hash)
    if (cached) return cached
    if (!storage) return null
    const bytes = await storage.get(hash)
    if (!bytes) return null
    const decoded = await decodeIdentityFromBytes(bytes)
    identityByHash.set(decoded.hash, decoded)
    return decoded
  }

  const addIdentity = (newIdentity: WebAuthnOrbitIdentity) => {
    identityByHash.set(newIdentity.hash, newIdentity)
    if (storage) {
      void storage.put(newIdentity.hash, newIdentity.bytes)
    }
  }

  return {
    verify,
    verifyIdentity,
    getIdentity,
    addIdentity,
  }
}

export function serializeIdentity(identity: WebAuthnOrbitIdentity): IdentityPayload {
  return {
    id: identity.id,
    publicKey: bytesToBase64url(identity.publicKey),
    signatures: {
      id: bytesToBase64url(identity.signatures.id),
      publicKey: bytesToBase64url(identity.signatures.publicKey),
    },
    type: identity.type,
    hash: identity.hash,
    bytes: bytesToBase64url(identity.bytes),
  }
}

export function deserializeIdentity(payload: IdentityPayload): WebAuthnOrbitIdentity {
  return {
    id: payload.id,
    publicKey: base64urlToBytes(payload.publicKey),
    signatures: {
      id: base64urlToBytes(payload.signatures.id),
      publicKey: base64urlToBytes(payload.signatures.publicKey),
    },
    type: payload.type,
    hash: payload.hash,
    bytes: base64urlToBytes(payload.bytes),
    sign: async () => {
      throw new Error('Remote identity cannot sign')
    },
    verify: async (signature, publicKey, data) =>
      verifyVarsigForPayload(signature, publicKey, data, 'orbitdb-entry:'),
  }
}

async function encodeIdentityValue(value: {
  id: string
  publicKey: Uint8Array
  signatures: { id: Uint8Array; publicKey: Uint8Array }
  type: string
}) {
  const { cid, bytes } = await Block.encode({
    value,
    codec: IDENTITY_CODEC,
    hasher: IDENTITY_HASHER,
  })
  return {
    hash: cid.toString(IDENTITY_HASH_ENCODING),
    bytes: Uint8Array.from(bytes),
  }
}

export function loadStoredIdentity(): OrbitDbIdentity | null {
  const stored = localStorage.getItem(STORAGE_KEY_ORBITDB_IDENTITY)
  if (!stored) {
    return null
  }
  const parsed = JSON.parse(stored) as {
    id: string
    did: string
    publicKey: string
    algorithm: 'Ed25519' | 'P-256'
    signatures: { id: string; publicKey: string }
  }
  return {
    id: parsed.id,
    did: parsed.did,
    publicKey: base64urlToBytes(parsed.publicKey),
    algorithm: parsed.algorithm,
    signatures: {
      id: base64urlToBytes(parsed.signatures.id),
      publicKey: base64urlToBytes(parsed.signatures.publicKey),
    },
  }
}

export function storeIdentity(identity: OrbitDbIdentity) {
  localStorage.setItem(
    STORAGE_KEY_ORBITDB_IDENTITY,
    JSON.stringify({
      id: identity.id,
      did: identity.did,
      publicKey: bytesToBase64url(identity.publicKey),
      algorithm: identity.algorithm,
      signatures: {
        id: bytesToBase64url(identity.signatures.id),
        publicKey: bytesToBase64url(identity.signatures.publicKey),
      },
    })
  )
}

export async function createOrbitDbIdentity() {
  const cachedIdentity = loadStoredIdentity()
  const stored = loadStoredCredential() ?? (await registerCredential())

  let identityData: OrbitDbIdentity
  let idOutput: { varsig: Uint8Array; verification: { valid: boolean }; signatureValid: boolean }
  let pubKeyOutput: { varsig: Uint8Array; verification: { valid: boolean }; signatureValid: boolean }

  if (cachedIdentity) {
    identityData = cachedIdentity
    const idValid = await verifyVarsigForPayload(
      identityData.signatures.id,
      identityData.publicKey,
      encoder.encode(identityData.id),
      'orbitdb-id:'
    )
    const pubKeyPayload = concat([
      identityData.publicKey,
      identityData.signatures.id,
    ])
    const publicKeyValid = await verifyVarsigForPayload(
      identityData.signatures.publicKey,
      identityData.publicKey,
      pubKeyPayload,
      'orbitdb-pubkey:'
    )
    idOutput = {
      varsig: identityData.signatures.id,
      verification: { valid: idValid },
      signatureValid: idValid,
    }
    pubKeyOutput = {
      varsig: identityData.signatures.publicKey,
      verification: { valid: publicKeyValid },
      signatureValid: publicKeyValid,
    }
  } else {
    const id = stored.did
    const idBytes = encoder.encode(id)

    const idAssertion = await runWebAuthnAssertionForPayload(
      idBytes,
      'orbitdb-id:'
    )
    const idBuilt = await buildVarsigOutput(idAssertion)

    const pubkeyPayload = concat([stored.publicKey, idBuilt.varsig])
    const pubKeyAssertion = await runWebAuthnAssertionForPayload(
      pubkeyPayload,
      'orbitdb-pubkey:'
    )
    const pubKeyBuilt = await buildVarsigOutput(pubKeyAssertion)

    identityData = {
      id,
      did: stored.did,
      publicKey: stored.publicKey,
      algorithm: stored.algorithm,
      signatures: {
        id: idBuilt.varsig,
        publicKey: pubKeyBuilt.varsig,
      },
    }

    idOutput = {
      varsig: idBuilt.varsig,
      verification: { valid: Boolean(idBuilt.verification.valid) },
      signatureValid: Boolean(idBuilt.signatureValid),
    }
    pubKeyOutput = {
      varsig: pubKeyBuilt.varsig,
      verification: { valid: Boolean(pubKeyBuilt.verification.valid) },
      signatureValid: Boolean(pubKeyBuilt.signatureValid),
    }
  }

  const sign = async (_identity: unknown, data: Uint8Array | string) => {
    const payloadBytes = toBytes(data)
    const assertion = await runWebAuthnAssertionForPayload(
      payloadBytes,
      'orbitdb-entry:'
    )
    const output = await buildVarsigOutput(assertion)
    if (!output.signatureValid) {
      throw new Error('WebAuthn signature failed for OrbitDB entry')
    }
    return output.varsig
  }

  const verify = async (
    signature: Uint8Array,
    publicKey: Uint8Array,
    data: Uint8Array | string
  ) => {
    return verifyVarsigForPayload(
      signature,
      publicKey,
      toBytes(data),
      'orbitdb-entry:'
    )
  }

  const { hash, bytes } = await encodeIdentityValue({
    id: identityData.id,
    publicKey: identityData.publicKey,
    signatures: identityData.signatures,
    type: 'webauthn-varsig',
  })

  const orbitdbIdentity: WebAuthnOrbitIdentity = {
    id: identityData.id,
    publicKey: identityData.publicKey,
    signatures: identityData.signatures,
    type: 'webauthn-varsig',
    sign,
    verify,
    hash,
    bytes,
  }

  storeIdentity(identityData)

  return {
    identityData,
    orbitdbIdentity,
    idOutput,
    pubKeyOutput,
  }
}

export { createWebAuthnIdentities }
