import assert from 'assert'
import { webcrypto } from 'iso-base/crypto'
import {
  decodeWebAuthnVarsigV1,
  derToRawSignature,
  encodeWebAuthnVarsigV1,
  reconstructSignedData,
  verifyP256Signature,
  verifyWebAuthnVarsig,
} from '../src/index.js'
import { bytesToBase64url } from '../src/utils.js'

/**
 * Build authenticatorData the way an authenticator would.
 *
 * @param {{ rpId: string, signCount?: number, userVerified?: boolean }} options
 */
async function authenticatorData({ rpId, signCount = 1, userVerified = true }) {
  const rpIdHash = new Uint8Array(
    await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId))
  )

  const data = new Uint8Array(37)
  data.set(rpIdHash, 0)
  data[32] = 0x01 | (userVerified ? 0x04 : 0)
  new DataView(data.buffer).setUint32(33, signCount)
  return data
}

/**
 * @param {{ challenge: Uint8Array, origin: string }} options
 */
function clientDataJSON({ challenge, origin }) {
  return new TextEncoder().encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: bytesToBase64url(challenge),
      origin,
      crossOrigin: false,
    })
  )
}

/**
 * Produce a genuine P-256 assertion: a real key, signing the real
 * authenticatorData || SHA-256(clientDataJSON) preimage, in the ASN.1 DER form
 * an authenticator emits.
 *
 * @param {{ rpId: string, origin: string, challenge: Uint8Array, signCount?: number }} options
 */
async function realP256Assertion({ rpId, origin, challenge, signCount = 1 }) {
  const keyPair = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  )

  const authData = await authenticatorData({ rpId, signCount })
  const clientData = clientDataJSON({ challenge, origin })
  const clientDataHash = new Uint8Array(
    await webcrypto.subtle.digest('SHA-256', clientData)
  )

  const signedData = new Uint8Array(authData.length + clientDataHash.length)
  signedData.set(authData, 0)
  signedData.set(clientDataHash, authData.length)

  // WebCrypto signs in raw r||s; an authenticator emits DER, so convert to get
  // a faithful fixture.
  const raw = new Uint8Array(
    await webcrypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      signedData
    )
  )

  const publicKey = new Uint8Array(
    await webcrypto.subtle.exportKey('raw', keyPair.publicKey)
  )

  return {
    assertion: {
      authenticatorData: authData,
      clientDataJSON: clientData,
      signature: rawToDer(raw),
    },
    rawSignature: raw,
    publicKey,
    signedData,
  }
}

/**
 * Wrap raw r||s as ASN.1 DER, the inverse of derToRawSignature.
 *
 * @param {Uint8Array} raw
 */
function rawToDer(raw) {
  const encodeInt = (/** @type {Uint8Array} */ value) => {
    let start = 0
    while (start < value.length - 1 && value[start] === 0) start++
    let v = value.subarray(start)
    // DER integers are signed, so a leading high bit needs a 0x00 pad.
    if (v[0] & 0x80) {
      const padded = new Uint8Array(v.length + 1)
      padded.set(v, 1)
      v = padded
    }
    return new Uint8Array([0x02, v.length, ...v])
  }

  const r = encodeInt(raw.subarray(0, 32))
  const s = encodeInt(raw.subarray(32, 64))
  return new Uint8Array([0x30, r.length + s.length, ...r, ...s])
}

describe('iso-webauthn-varsig crypto', () => {
  const origin = 'https://example.com'
  const rpId = 'example.com'

  it('verifies a genuine P-256 assertion end to end', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey } = await realP256Assertion({
      rpId,
      origin,
      challenge,
    })

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(assertion, 'P-256')
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: challenge,
      publicKey,
    })

    assert.strictEqual(result.error, undefined)
    assert.strictEqual(result.valid, true)
  })

  it('accepts the DER signature an authenticator actually emits', async () => {
    // The regression this file exists for: WebCrypto only understands raw
    // r||s, so passing DER straight through made every real signature fail.
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey, signedData, rawSignature } =
      await realP256Assertion({ rpId, origin, challenge })

    assert.strictEqual(assertion.signature[0], 0x30, 'fixture must be DER')
    assert.ok(assertion.signature.length > 64, 'DER is longer than raw')

    assert.strictEqual(
      await verifyP256Signature(signedData, assertion.signature, publicKey),
      true,
      'DER signature must verify'
    )
    assert.strictEqual(
      await verifyP256Signature(signedData, rawSignature, publicKey),
      true,
      'raw signature must verify too'
    )
  })

  it('round-trips DER to raw', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, rawSignature } = await realP256Assertion({
      rpId,
      origin,
      challenge,
    })

    assert.deepStrictEqual(derToRawSignature(assertion.signature), rawSignature)
    // Already-raw input passes through untouched.
    assert.deepStrictEqual(derToRawSignature(rawSignature), rawSignature)
  })

  it('rejects a tampered signature', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey } = await realP256Assertion({
      rpId,
      origin,
      challenge,
    })

    const tampered = {
      ...assertion,
      signature: new Uint8Array(assertion.signature),
    }
    tampered.signature[tampered.signature.length - 1] ^= 0xff

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(tampered, 'P-256')
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: challenge,
      publicKey,
    })

    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.error, 'Signature is invalid')
  })

  it('rejects a signature made over different data', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const a = await realP256Assertion({ rpId, origin, challenge })
    const b = await realP256Assertion({ rpId, origin, challenge })

    // b's signature under a's key: structurally valid, cryptographically wrong.
    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(
        { ...a.assertion, signature: b.assertion.signature },
        'P-256'
      )
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: challenge,
      publicKey: a.publicKey,
    })

    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.error, 'Signature is invalid')
  })

  it('reconstructs the exact preimage the authenticator signed', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, signedData } = await realP256Assertion({
      rpId,
      origin,
      challenge,
    })

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(assertion, 'P-256')
    )

    assert.deepStrictEqual(await reconstructSignedData(decoded), signedData)
  })

  it('does not treat a counter of 0 on both sides as a replay', async () => {
    // Apple's platform authenticators always report 0; WebAuthn L2 §6.1.1 says
    // that means "no counter", not "replayed".
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey } = await realP256Assertion({
      rpId,
      origin,
      challenge,
      signCount: 0,
    })

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(assertion, 'P-256')
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: challenge,
      publicKey,
      previousSignCount: 0,
    })

    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.signCount, 0)
  })

  it('still rejects a genuinely replayed counter', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey } = await realP256Assertion({
      rpId,
      origin,
      challenge,
      signCount: 5,
    })

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(assertion, 'P-256')
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: challenge,
      publicKey,
      previousSignCount: 5,
    })

    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.error, 'signCount is not monotonic')
  })

  it('reads a counter above 2^31 as unsigned', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey } = await realP256Assertion({
      rpId,
      origin,
      challenge,
      signCount: 0x8000_0000,
    })

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(assertion, 'P-256')
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: challenge,
      publicKey,
    })

    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.signCount, 2_147_483_648)
  })

  it('rejects an assertion whose challenge does not match', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion, publicKey } = await realP256Assertion({
      rpId,
      origin,
      challenge,
    })

    const decoded = decodeWebAuthnVarsigV1(
      encodeWebAuthnVarsigV1(assertion, 'P-256')
    )

    const result = await verifyWebAuthnVarsig(decoded, {
      expectedOrigin: origin,
      expectedRpId: rpId,
      expectedChallenge: webcrypto.getRandomValues(new Uint8Array(32)),
      publicKey,
    })

    assert.strictEqual(result.valid, false)
    assert.strictEqual(result.error, 'Challenge mismatch')
  })

  it('rejects trailing bytes appended to a varsig', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion } = await realP256Assertion({ rpId, origin, challenge })

    const varsig = encodeWebAuthnVarsigV1(assertion, 'P-256')
    const padded = new Uint8Array(varsig.length + 3)
    padded.set(varsig, 0)

    assert.throws(() => decodeWebAuthnVarsigV1(padded), /Trailing bytes/)
  })

  it('reports truncated input as a decode error', async () => {
    const challenge = webcrypto.getRandomValues(new Uint8Array(32))
    const { assertion } = await realP256Assertion({ rpId, origin, challenge })

    const varsig = encodeWebAuthnVarsigV1(assertion, 'P-256')
    assert.throws(
      () => decodeWebAuthnVarsigV1(varsig.slice(0, 4)),
      /Varsig truncated|Unsupported|Invalid/
    )
  })
})
