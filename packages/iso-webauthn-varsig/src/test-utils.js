/**
 * Mock WebAuthn Data for Testing.
 *
 * Provides realistic WebAuthn assertion data for unit tests
 * without requiring actual WebAuthn credentials.
 */

/**
 * Create mock authenticatorData.
 *
 * @param {{ userPresent?: boolean, userVerified?: boolean, signCount?: number }} [options]
 */
export function createMockAuthenticatorData(options = {}) {
  const {
    userPresent = true,
    userVerified = true,
    signCount = 1,
  } = options

  const rpIdHash = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    rpIdHash[i] = (i * 7 + 13) % 256
  }

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

/**
 * Create mock clientDataJSON.
 *
 * @param {{ challenge?: string, origin?: string, type?: 'webauthn.get' | 'webauthn.create' }} [options]
 */
export function createMockClientDataJSON(options = {}) {
  const {
    challenge = 'mock-challenge-base64url',
    origin = 'https://example.com',
    type = 'webauthn.get',
  } = options

  const clientData = {
    type,
    challenge,
    origin,
    crossOrigin: false,
  }

  return new TextEncoder().encode(JSON.stringify(clientData))
}

/**
 * Create mock Ed25519 signature (64 bytes).
 */
export function createMockEd25519Signature() {
  const signature = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    signature[i] = (i * 3 + 7) % 256
  }
  return signature
}

/**
 * Create mock P-256 signature (DER format).
 */
export function createMockP256Signature() {
  const r = new Uint8Array(32)
  const s = new Uint8Array(32)

  for (let i = 0; i < 32; i++) {
    r[i] = (i * 5 + 11) % 256
    s[i] = (i * 7 + 13) % 256
  }

  const signature = new Uint8Array(6 + 32 + 32)
  signature[0] = 0x30
  signature[1] = 68
  signature[2] = 0x02
  signature[3] = 32
  signature.set(r, 4)
  signature[36] = 0x02
  signature[37] = 32
  signature.set(s, 38)

  return signature
}

/**
 * Create complete mock WebAuthn assertion for Ed25519.
 *
 * @param {{ challenge?: string, origin?: string, userPresent?: boolean, userVerified?: boolean }} [options]
 */
export function createMockEd25519Assertion(options = {}) {
  return {
    authenticatorData: createMockAuthenticatorData({
      userPresent: options.userPresent,
      userVerified: options.userVerified,
    }),
    clientDataJSON: createMockClientDataJSON({
      challenge: options.challenge,
      origin: options.origin,
      type: 'webauthn.get',
    }),
    signature: createMockEd25519Signature(),
  }
}

/**
 * Create complete mock WebAuthn assertion for P-256.
 *
 * @param {{ challenge?: string, origin?: string, userPresent?: boolean, userVerified?: boolean }} [options]
 */
export function createMockP256Assertion(options = {}) {
  return {
    authenticatorData: createMockAuthenticatorData({
      userPresent: options.userPresent,
      userVerified: options.userVerified,
    }),
    clientDataJSON: createMockClientDataJSON({
      challenge: options.challenge,
      origin: options.origin,
      type: 'webauthn.get',
    }),
    signature: createMockP256Signature(),
  }
}
