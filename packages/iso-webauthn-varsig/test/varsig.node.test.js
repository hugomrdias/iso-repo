import assert from 'assert'
import {
  decodeWebAuthnVarsigV1,
  encodeWebAuthnVarsigV1,
  MULTIHASH_SHA256,
  PAYLOAD_ENCODING_RAW,
  parseClientDataJSON,
  VARSIG_PREFIX,
  VARSIG_VERSION,
  verifyWebAuthnAssertion,
} from '../src/index.js'
import {
  createMockClientDataJSON,
  createMockEd25519Assertion,
  createMockEd25519Signature,
  createMockP256Assertion,
  createMockP256Signature,
} from '../src/test-utils.js'
import { bytesToBase64url, varintDecode, varintEncode } from '../src/utils.js'

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

describe('iso-webauthn-varsig', () => {
  it('roundtrips Ed25519 varsig', () => {
    const assertion = createMockEd25519Assertion()
    const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')
    const decoded = decodeWebAuthnVarsigV1(varsig)

    assert.strictEqual(decoded.algorithm, 'Ed25519')
    assert.deepStrictEqual(
      decoded.authenticatorData,
      assertion.authenticatorData
    )
    assert.deepStrictEqual(decoded.clientDataJSON, assertion.clientDataJSON)
    assert.deepStrictEqual(decoded.signature, assertion.signature)
    assert.strictEqual(decoded.signatureHashAlgorithm, MULTIHASH_SHA256)
    assert.strictEqual(decoded.encodingInfo, PAYLOAD_ENCODING_RAW)
  })

  it('roundtrips P-256 varsig', () => {
    const assertion = createMockP256Assertion()
    const varsig = encodeWebAuthnVarsigV1(assertion, 'P-256')
    const decoded = decodeWebAuthnVarsigV1(varsig)

    assert.strictEqual(decoded.algorithm, 'P-256')
    assert.deepStrictEqual(
      decoded.authenticatorData,
      assertion.authenticatorData
    )
    assert.deepStrictEqual(decoded.clientDataJSON, assertion.clientDataJSON)
    assert.deepStrictEqual(decoded.signature, assertion.signature)
    assert.strictEqual(decoded.signatureHashAlgorithm, MULTIHASH_SHA256)
    assert.strictEqual(decoded.encodingInfo, PAYLOAD_ENCODING_RAW)
  })

  it('encodes wire format in correct order: header then clientData then authData then sig metadata then sig', () => {
    const assertion = createMockEd25519Assertion()
    const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519')

    // header: prefix + version
    assert.strictEqual(varsig[0], VARSIG_PREFIX)
    assert.strictEqual(varsig[1], VARSIG_VERSION)

    // skip header varints (innerAlgorithm, curve, webauthnMarker)
    let offset = 2
    const [, innerLen] = varintDecode(varsig, offset)
    offset += innerLen
    const [, curveLen] = varintDecode(varsig, offset)
    offset += curveLen
    const [, markerLen] = varintDecode(varsig, offset)
    offset += markerLen

    // body: clientData first
    const [clientDataLen, cdLenLen] = varintDecode(varsig, offset)
    offset += cdLenLen
    const clientData = varsig.slice(offset, offset + clientDataLen)
    offset += clientDataLen
    assert.deepStrictEqual(clientData, assertion.clientDataJSON)

    // then authData
    const [authDataLen, adLenLen] = varintDecode(varsig, offset)
    offset += adLenLen
    const authData = varsig.slice(offset, offset + authDataLen)
    offset += authDataLen
    assert.deepStrictEqual(authData, assertion.authenticatorData)

    // then signatureHashAlgorithm + encodingInfo
    const [sigHash, shLen] = varintDecode(varsig, offset)
    offset += shLen
    const [encInfo, eiLen] = varintDecode(varsig, offset)
    offset += eiLen
    assert.strictEqual(sigHash, MULTIHASH_SHA256)
    assert.strictEqual(encInfo, PAYLOAD_ENCODING_RAW)

    // then raw signature bytes
    assert.deepStrictEqual(varsig.slice(offset), assertion.signature)
  })

  it('accepts custom signatureHashAlgorithm and encodingInfo via EncodeOptions', () => {
    const assertion = createMockEd25519Assertion()
    const customHash = 0x13 // SHA-512 multicodec
    const customEnc = 0x60 // arbitrary
    const varsig = encodeWebAuthnVarsigV1(assertion, 'Ed25519', {
      signatureHashAlgorithm: customHash,
      encodingInfo: customEnc,
    })
    const decoded = decodeWebAuthnVarsigV1(varsig)

    assert.strictEqual(decoded.signatureHashAlgorithm, customHash)
    assert.strictEqual(decoded.encodingInfo, customEnc)
    assert.deepStrictEqual(decoded.signature, assertion.signature)
  })

  it('rejects old-format (v0.1) encoded bytes', () => {
    // Build a payload in the OLD format: header had multihashCode, multihashLength, payloadEncoding
    // and body was authData-first. This must fail to decode correctly.
    const assertion = createMockEd25519Assertion()
    const header = new Uint8Array([VARSIG_PREFIX, VARSIG_VERSION])
    const parts = [
      header,
      varintEncode(0xed), // innerAlgorithm (EdDSA)
      varintEncode(0xed01), // curve (Ed25519)
      varintEncode(0x12), // multihashCode (old header field)
      varintEncode(0x20), // multihashLength (old header field)
      varintEncode(0x300001), // webauthnMarker
      varintEncode(0x5f), // payloadEncoding (old header field)
      varintEncode(assertion.authenticatorData.length),
      assertion.authenticatorData,
      varintEncode(assertion.clientDataJSON.length),
      assertion.clientDataJSON,
      assertion.signature,
    ]
    let totalLen = 0
    for (const p of parts) totalLen += p.length
    const oldFormat = new Uint8Array(totalLen)
    let off = 0
    for (const p of parts) {
      oldFormat.set(p, off)
      off += p.length
    }

    // Decoding old format should fail or produce wrong data
    assert.throws(() => {
      const decoded = decodeWebAuthnVarsigV1(oldFormat)
      // Even if it doesn't throw, the data won't roundtrip correctly
      // because the decoder reads fields in the new order
      if (!decoded.authenticatorData.length || !decoded.clientDataJSON.length) {
        throw new Error('Decoded garbage')
      }
      // The webauthnMarker check will fail because 0x12 is read as
      // the webauthnMarker instead of 0x300001
    })
  })

  it('parses clientDataJSON', () => {
    const expectedChallenge = new Uint8Array([9, 8, 7, 6])
    const clientDataJSON = createMockClientDataJSON({
      challenge: bytesToBase64url(expectedChallenge),
      origin: 'https://example.com',
      type: 'webauthn.get',
    })
    const parsed = parseClientDataJSON(clientDataJSON)

    assert.strictEqual(parsed.type, 'webauthn.get')
    assert.strictEqual(parsed.origin, 'https://example.com')
    assert.strictEqual(parsed.challenge, bytesToBase64url(expectedChallenge))
  })

  it('verifies WebAuthn assertion for Ed25519', async () => {
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

    assert.strictEqual(decoded.algorithm, 'Ed25519')
    const result = await verifyWebAuthnAssertion(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge,
    })

    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.signCount, 2)
    assert.deepStrictEqual(result.flags, {
      userPresent: true,
      userVerified: true,
      backupEligible: false,
      backupState: false,
    })
  })

  it('verifies WebAuthn assertion for P-256', async () => {
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

    assert.strictEqual(decoded.algorithm, 'P-256')
    const result = await verifyWebAuthnAssertion(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge,
    })

    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.signCount, 3)
    assert.deepStrictEqual(result.flags, {
      userPresent: true,
      userVerified: true,
      backupEligible: false,
      backupState: false,
    })
  })
})
