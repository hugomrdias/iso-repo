import { assert, suite } from 'playwright-test/taps'
import {
  decodeWebAuthnVarsigV1,
  encodeWebAuthnVarsigV1,
  parseClientDataJSON,
  verifyWebAuthnAssertion,
} from '../src/index.js'
import {
  createMockClientDataJSON,
  createMockEd25519Assertion,
  createMockEd25519Signature,
  createMockP256Assertion,
  createMockP256Signature,
} from '../src/test-utils.js'
import { bytesToBase64url } from '../src/utils.js'

const test = suite('webauthn-varsig')

/**
 * @param {{ rpId: string, userPresent?: boolean, userVerified?: boolean, signCount?: number }} options
 */
async function createAuthenticatorData({
  rpId,
  userPresent = true,
  userVerified = true,
  signCount = 1,
}) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto subtle API not available')
  }

  const rpIdBytes = new TextEncoder().encode(rpId)
  const rpIdHash = new Uint8Array(
    await globalThis.crypto.subtle.digest('SHA-256', rpIdBytes)
  )

  let flags = 0
  if (userPresent) flags |= 0x01
  if (userVerified) flags |= 0x04

  const signCountBytes = new Uint8Array(4)
  signCountBytes[0] = (signCount >> 24) & 0xff
  signCountBytes[1] = (signCount >> 16) & 0xff
  signCountBytes[2] = (signCount >> 8) & 0xff
  signCountBytes[3] = signCount & 0xff

  const authenticatorData = new Uint8Array(37)
  authenticatorData.set(rpIdHash, 0)
  authenticatorData[32] = flags
  authenticatorData.set(signCountBytes, 33)

  return authenticatorData
}

test('roundtrips Ed25519 varsig', () => {
  const assertion = createMockEd25519Assertion()
  const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')
  const decoded = decodeWebAuthnVarsigV1(varsig)

  assert.equal(decoded.algorithm, 'Ed25519')
  assert.deepEqual(decoded.authenticatorData, assertion.authenticatorData)
  assert.deepEqual(decoded.clientDataJSON, assertion.clientDataJSON)
  assert.deepEqual(decoded.signature, assertion.signature)
})

test('roundtrips P-256 varsig', () => {
  const assertion = createMockP256Assertion()
  const varsig = encodeWebAuthnVarsigV1(assertion, 'P-256')
  const decoded = decodeWebAuthnVarsigV1(varsig)

  assert.equal(decoded.algorithm, 'P-256')
  assert.deepEqual(decoded.authenticatorData, assertion.authenticatorData)
  assert.deepEqual(decoded.clientDataJSON, assertion.clientDataJSON)
  assert.deepEqual(decoded.signature, assertion.signature)
})

test('parses clientDataJSON', () => {
  const expectedChallenge = new Uint8Array([9, 8, 7, 6])
  const clientDataJSON = createMockClientDataJSON({
    challenge: bytesToBase64url(expectedChallenge),
    origin: 'https://example.com',
    type: 'webauthn.get',
  })
  const parsed = parseClientDataJSON(clientDataJSON)

  assert.equal(parsed.type, 'webauthn.get')
  assert.equal(parsed.origin, 'https://example.com')
  assert.equal(parsed.challenge, bytesToBase64url(expectedChallenge))
})

test('verifies WebAuthn assertion for Ed25519', async () => {
  const expectedChallenge = new Uint8Array([1, 2, 3, 4])
  const origin = 'https://example.com'
  const rpId = new URL(origin).hostname
  const authenticatorData = await createAuthenticatorData({
    rpId,
    signCount: 2,
  })
  const clientDataJSON = createMockClientDataJSON({
    challenge: bytesToBase64url(expectedChallenge),
    origin,
    type: 'webauthn.get',
  })
  const assertion = {
    authenticatorData,
    clientDataJSON,
    signature: createMockEd25519Signature(),
  }
  const decoded = decodeWebAuthnVarsigV1(
    encodeWebAuthnVarsigV1(assertion, 'Ed25519')
  )

  assert.equal(decoded.algorithm, 'Ed25519')
  const result = await verifyWebAuthnAssertion(decoded, {
    expectedOrigin: origin,
    expectedRpId: rpId,
    expectedChallenge,
  })

  assert.equal(result.valid, true)
  assert.equal(result.signCount, 2)
  assert.deepEqual(result.flags, {
    userPresent: true,
    userVerified: true,
    backupEligible: false,
    backupState: false,
  })
})

test('verifies WebAuthn assertion for P-256', async () => {
  const expectedChallenge = new Uint8Array([5, 6, 7, 8])
  const origin = 'https://example.net'
  const rpId = new URL(origin).hostname
  const authenticatorData = await createAuthenticatorData({
    rpId,
    signCount: 3,
  })
  const clientDataJSON = createMockClientDataJSON({
    challenge: bytesToBase64url(expectedChallenge),
    origin,
    type: 'webauthn.get',
  })
  const assertion = {
    authenticatorData,
    clientDataJSON,
    signature: createMockP256Signature(),
  }
  const decoded = decodeWebAuthnVarsigV1(
    encodeWebAuthnVarsigV1(assertion, 'P-256')
  )

  assert.equal(decoded.algorithm, 'P-256')
  const result = await verifyWebAuthnAssertion(decoded, {
    expectedOrigin: origin,
    expectedRpId: rpId,
    expectedChallenge,
  })

  assert.equal(result.valid, true)
  assert.equal(result.signCount, 3)
  assert.deepEqual(result.flags, {
    userPresent: true,
    userVerified: true,
    backupEligible: false,
    backupState: false,
  })
})
