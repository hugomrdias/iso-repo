import { unwrapEC2Signature } from 'iso-passkeys'
import {
  bytesToBase64url,
  concat,
  CURVE_ED25519,
  CURVE_P256,
  decodeWebAuthnVarsigV1,
  encodeWebAuthnVarsigV1,
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
  verifyEd25519Signature,
  verifyP256Signature,
  verifyWebAuthnAssertion,
  WEBAUTHN_WRAPPER,
} from 'iso-webauthn-varsig'
import { loadStoredCredential } from './credential'

const encoder = new TextEncoder()

function toArrayBuffer(bytes: Uint8Array<ArrayBufferLike>): ArrayBuffer {
  return bytes.slice().buffer
}

function buildChallengeBytes(domainLabel: string, payloadBytes: Uint8Array) {
  const domain = encoder.encode(domainLabel)
  return crypto.subtle
    .digest('SHA-256', concat([domain, payloadBytes]))
    .then((hash) => new Uint8Array(hash))
}

function algorithmFromPublicKey(publicKey: Uint8Array) {
  if (publicKey.length === 32) {
    return 'Ed25519'
  }
  if (publicKey.length === 65 && publicKey[0] === 0x04) {
    return 'P-256'
  }
  throw new Error('Unsupported public key format')
}

export function toBytes(data: Uint8Array | string) {
  return typeof data === 'string' ? encoder.encode(data) : data
}

export async function runWebAuthnAssertionForPayload(
  payloadBytes: Uint8Array,
  domainLabel: string
) {
  const rpId = window.location.hostname
  const origin = window.location.origin
  const challengeBytes = await buildChallengeBytes(domainLabel, payloadBytes)
  const challenge = bytesToBase64url(challengeBytes)

  const stored = loadStoredCredential()
  if (!stored) {
    throw new Error('No stored passkey. Register first.')
  }
  const { credentialId, publicKey, did, cose, algorithm } = stored
  const assertion = (await navigator.credentials.get({
    publicKey: {
      rpId,
      challenge: challengeBytes,
      allowCredentials: [
        {
          type: 'public-key',
          id: toArrayBuffer(credentialId),
        },
      ],
      userVerification: 'preferred',
    },
  })) as PublicKeyCredential | null

  if (!assertion) {
    throw new Error('Passkey authentication failed.')
  }

  const response = assertion.response as AuthenticatorAssertionResponse

  return {
    rpId,
    origin,
    challenge,
    challengeBytes,
    publicKey,
    did,
    cose,
    algorithm,
    assertion: {
      authenticatorData: new Uint8Array(response.authenticatorData),
      clientDataJSON: new Uint8Array(response.clientDataJSON),
      signature: new Uint8Array(response.signature),
    },
  }
}

export async function buildVarsigOutput(
  assertionData: Awaited<ReturnType<typeof runWebAuthnAssertionForPayload>>
) {
  const { assertion, algorithm, origin, rpId, challengeBytes, publicKey } =
    assertionData
  const varsig = encodeWebAuthnVarsigV1(assertion, algorithm)
  const decoded = decodeWebAuthnVarsigV1(varsig)
  const clientData = parseClientDataJSON(decoded.clientDataJSON)

  const verification = await verifyWebAuthnAssertion(decoded, {
    expectedOrigin: origin,
    expectedRpId: rpId,
    expectedChallenge: challengeBytes,
  })

  const signedData = await reconstructSignedData(decoded)
  const signatureBytes = Uint8Array.from(decoded.signature)
  let p256Signature = signatureBytes
  if (signatureBytes.length !== 64) {
    try {
      p256Signature = Uint8Array.from(unwrapEC2Signature(signatureBytes))
    } catch {
      p256Signature = signatureBytes
    }
  }
  const signatureValid =
    algorithm === 'Ed25519'
      ? await verifyEd25519Signature(signedData, decoded.signature, publicKey)
      : await verifyP256Signature(signedData, p256Signature, publicKey)

  return {
    varsig,
    decoded,
    clientData,
    verification,
    signedData,
    signatureValid,
  }
}

export async function verifyVarsigForPayload(
  signature: Uint8Array,
  publicKey: Uint8Array,
  payloadBytes: Uint8Array,
  domainLabel: string
) {
  const decoded = decodeWebAuthnVarsigV1(signature)
  const clientData = parseClientDataJSON(decoded.clientDataJSON)
  const expectedChallenge = await buildChallengeBytes(domainLabel, payloadBytes)
  const expectedChallengeEncoded = bytesToBase64url(expectedChallenge)

  if (clientData.challenge !== expectedChallengeEncoded) {
    return false
  }

  const verification = await verifyWebAuthnAssertion(decoded, {
    expectedOrigin: window.location.origin,
    expectedRpId: window.location.hostname,
    expectedChallenge,
  })

  if (!verification.valid) {
    return false
  }

  const signedData = await reconstructSignedData(decoded)
  const signatureBytes = Uint8Array.from(decoded.signature)
  let p256Signature = signatureBytes
  if (signatureBytes.length !== 64) {
    try {
      p256Signature = Uint8Array.from(unwrapEC2Signature(signatureBytes))
    } catch {
      p256Signature = signatureBytes
    }
  }

  const algorithm = algorithmFromPublicKey(publicKey)
  return algorithm === 'Ed25519'
    ? verifyEd25519Signature(signedData, decoded.signature, publicKey)
    : verifyP256Signature(signedData, p256Signature, publicKey)
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

export { decodeWebAuthnVarsigV1, parseClientDataJSON, verifyWebAuthnAssertion }
