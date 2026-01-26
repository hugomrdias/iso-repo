import {
  buildVarsigOutput as buildProviderVarsigOutput,
  runWebAuthnAssertionForPayload as runProviderAssertionForPayload,
  toBytes,
  verifyVarsigForPayload,
} from '@le-space/orbitdb-identity-provider-webauthn-did/src/varsig/assertion.js'
import {
  bytesToBase64url,
  CURVE_ED25519,
  CURVE_P256,
  concat,
  decodeWebAuthnVarsigV1,
  INNER_ECDSA,
  INNER_EDDSA,
  MULTIHASH_SHA256,
  MULTIHASH_SHA256_LEN,
  PAYLOAD_ENCODING_RAW,
  parseClientDataJSON,
  reconstructSignedData,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  varintEncode,
  verifyWebAuthnAssertion,
  WEBAUTHN_WRAPPER,
} from 'iso-webauthn-varsig'
import { loadStoredCredential } from './credential'

const encoder = new TextEncoder()

export async function runWebAuthnAssertionForPayload(
  payloadBytes: Uint8Array,
  domainLabel: string
) {
  const stored = loadStoredCredential()
  if (!stored) {
    throw new Error('No stored passkey. Register first.')
  }

  const assertionData = await runProviderAssertionForPayload(
    stored,
    payloadBytes,
    domainLabel
  )
  const challenge = bytesToBase64url(assertionData.challengeBytes)

  return {
    ...assertionData,
    challenge,
    did: stored.did,
    cose: stored.cose,
  }
}

export async function buildVarsigOutput(
  assertionData: Awaited<ReturnType<typeof runWebAuthnAssertionForPayload>>
) {
  const output = await buildProviderVarsigOutput(assertionData)
  const decoded = decodeWebAuthnVarsigV1(output.varsig)
  const clientData = parseClientDataJSON(decoded.clientDataJSON)
  const signedData = await reconstructSignedData(decoded)

  return {
    varsig: output.varsig,
    decoded,
    clientData,
    verification: output.verification,
    signedData,
    signatureValid: output.signatureValid,
  }
}

export async function runWebAuthnAssertion() {
  const payload = { scope: 'webauthn-varsig-demo', ts: Date.now() }
  const payloadText = JSON.stringify(payload)
  const payloadBytes = encoder.encode(payloadText)

  const assertionData = await runWebAuthnAssertionForPayload(
    payloadBytes,
    'ucan-webauthn-v1:'
  )

  return {
    ...assertionData,
    payloadBytes,
    payloadText,
    payloadTs: payload.ts,
  }
}

export function buildVarsigHeader(algorithm: 'Ed25519' | 'P-256'): Uint8Array {
  const innerAlgorithm = algorithm === 'Ed25519' ? INNER_EDDSA : INNER_ECDSA
  const curve = algorithm === 'Ed25519' ? CURVE_ED25519 : CURVE_P256

  return concat([
    new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION]),
    varintEncode(innerAlgorithm),
    varintEncode(curve),
    varintEncode(MULTIHASH_SHA256),
    varintEncode(MULTIHASH_SHA256_LEN),
    varintEncode(WEBAUTHN_WRAPPER),
    varintEncode(PAYLOAD_ENCODING_RAW),
  ])
}

export {
  decodeWebAuthnVarsigV1,
  parseClientDataJSON,
  verifyWebAuthnAssertion,
  verifyVarsigForPayload,
  toBytes,
}
