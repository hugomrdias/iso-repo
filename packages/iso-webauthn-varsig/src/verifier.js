import { webcrypto } from 'iso-base/crypto'
import { parseClientDataJSON } from './decoder.js'
import { derToRawSignature } from './signature.js'
import { base64urlToBytes, bytesEqual } from './utils.js'

/**
 * @typedef {import('./types').ClientDataJSON} ClientDataJSON
 * @typedef {import('./types').WebAuthnDecoded} WebAuthnDecoded
 * @typedef {import('./types').DecodedVarsigV1} DecodedVarsigV1
 */

/**
 * @typedef {object} VerificationOptions
 * @property {string} expectedOrigin
 * @property {string} expectedRpId
 * @property {Uint8Array} expectedChallenge
 * @property {boolean} [requireUserVerification]
 * @property {number} [previousSignCount]
 */

/**
 * @typedef {object} VerificationResult
 * @property {boolean} valid
 * @property {string} [error]
 * @property {ClientDataJSON} [clientData]
 * @property {number} [signCount]
 * @property {{ userPresent: boolean, userVerified: boolean, backupEligible: boolean, backupState: boolean }} [flags]
 */

/**
 * Check the non-cryptographic parts of a WebAuthn assertion: ceremony type,
 * origin, challenge, rpIdHash, the UP/UV flags and the signature counter.
 *
 * **This does not verify the signature.** A `valid: true` result means the
 * assertion is well-formed and addressed to you, not that it is authentic —
 * on its own it accepts a fabricated `signature`. Use
 * {@link verifyWebAuthnVarsig}, which performs these checks *and* the
 * cryptographic one, unless you have a reason to separate the two.
 *
 * @param {WebAuthnDecoded} decoded
 * @param {VerificationOptions} options
 * @returns {Promise<VerificationResult>}
 */
export async function verifyWebAuthnAssertion(decoded, options) {
  try {
    const clientData = parseClientDataJSON(decoded.clientDataJSON)

    if (clientData.type !== 'webauthn.get') {
      return {
        valid: false,
        error: `Invalid ceremony type: ${clientData.type}, expected 'webauthn.get'`,
      }
    }

    if (clientData.origin !== options.expectedOrigin) {
      return {
        valid: false,
        error: `Origin mismatch: expected ${options.expectedOrigin}, got ${clientData.origin}`,
      }
    }

    const challengeBytes = base64urlToBytes(clientData.challenge)
    if (!bytesEqual(challengeBytes, options.expectedChallenge)) {
      return {
        valid: false,
        error: 'Challenge mismatch',
      }
    }

    if (decoded.authenticatorData.length < 37) {
      return {
        valid: false,
        error: `Invalid authenticatorData length: ${decoded.authenticatorData.length}, expected >= 37`,
      }
    }

    const rpIdHash = decoded.authenticatorData.slice(0, 32)
    const flags = decoded.authenticatorData[32]
    // Big-endian uint32. Assembling this with `<< 24` yields a *signed* int32,
    // so any counter at or above 2^31 would come out negative.
    const signCountBytes = decoded.authenticatorData.slice(33, 37)
    const signCount = new DataView(
      signCountBytes.buffer,
      signCountBytes.byteOffset,
      signCountBytes.byteLength
    ).getUint32(0)
    const userPresent = (flags & 0x01) !== 0
    const userVerified = (flags & 0x04) !== 0
    const backupEligible = (flags & 0x08) !== 0
    const backupState = (flags & 0x10) !== 0

    if (!webcrypto?.subtle) {
      return {
        valid: false,
        error: 'WebCrypto subtle API not available',
      }
    }

    const rpIdBytes = new TextEncoder().encode(options.expectedRpId)
    const rpIdHashExpected = new Uint8Array(
      await webcrypto.subtle.digest('SHA-256', rpIdBytes)
    )

    if (!bytesEqual(rpIdHash, rpIdHashExpected)) {
      return {
        valid: false,
        error: 'rpIdHash mismatch',
      }
    }

    if (!userPresent) {
      return {
        valid: false,
        error: 'User presence (UP) flag not set',
      }
    }

    if (options.requireUserVerification !== false && !userVerified) {
      return {
        valid: false,
        error: 'User verification (UV) flag not set',
      }
    }

    // WebAuthn L2 §6.1.1: when both the stored and the received counter are 0,
    // the authenticator does not implement one, and that must not be treated as
    // a failure. Apple's platform authenticators always report 0, so comparing
    // unconditionally would reject every assertion they produce.
    if (
      options.previousSignCount !== undefined &&
      !(signCount === 0 && options.previousSignCount === 0) &&
      signCount <= options.previousSignCount
    ) {
      return {
        valid: false,
        error: 'signCount is not monotonic',
      }
    }

    return {
      valid: true,
      clientData,
      signCount,
      flags: {
        userPresent,
        userVerified,
        backupEligible,
        backupState,
      },
    }
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Reconstruct the data that was signed by WebAuthn.
 *
 * WebAuthn signs: authenticatorData || SHA-256(clientDataJSON)
 *
 * @param {WebAuthnDecoded} decoded
 * @returns {Promise<Uint8Array>}
 */
export async function reconstructSignedData(decoded) {
  if (!webcrypto?.subtle) {
    throw new Error('WebCrypto subtle API not available')
  }

  const clientDataJSON = new Uint8Array(decoded.clientDataJSON)
  const clientDataHash = await webcrypto.subtle.digest(
    'SHA-256',
    clientDataJSON
  )

  const signedData = new Uint8Array(
    decoded.authenticatorData.length + clientDataHash.byteLength
  )
  signedData.set(decoded.authenticatorData, 0)
  signedData.set(
    new Uint8Array(clientDataHash),
    decoded.authenticatorData.length
  )

  return signedData
}

/**
 * Verify Ed25519 signature (requires WebCrypto API).
 *
 * @param {Uint8Array} signedData
 * @param {Uint8Array} signature
 * @param {Uint8Array} publicKey
 */
export async function verifyEd25519Signature(signedData, signature, publicKey) {
  try {
    if (!webcrypto?.subtle) {
      return false
    }

    const publicKeyBytes = new Uint8Array(publicKey)
    const signatureBytes = new Uint8Array(signature)
    const signedDataBytes = new Uint8Array(signedData)
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'Ed25519' },
      false,
      ['verify']
    )

    return await webcrypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signatureBytes,
      signedDataBytes
    )
  } catch {
    return false
  }
}

/**
 * Verify a P-256 signature (requires WebCrypto API).
 *
 * Accepts the signature either as the ASN.1 DER a WebAuthn authenticator
 * returns, or as raw r||s. WebCrypto only understands the latter, so DER is
 * converted here rather than left to the caller — getting that wrong makes
 * every genuine assertion fail silently, because `verify` returns false
 * instead of throwing.
 *
 * @param {Uint8Array} signedData
 * @param {Uint8Array} signature - ASN.1 DER or raw r||s.
 * @param {Uint8Array} publicKey - Uncompressed P-256 point (65 bytes, 0x04 || x || y).
 */
export async function verifyP256Signature(signedData, signature, publicKey) {
  try {
    if (!webcrypto?.subtle) {
      return false
    }

    const publicKeyBytes = new Uint8Array(publicKey)
    const signatureBytes = new Uint8Array(
      derToRawSignature(new Uint8Array(signature))
    )
    const signedDataBytes = new Uint8Array(signedData)
    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      publicKeyBytes,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )

    return await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signatureBytes,
      signedDataBytes
    )
  } catch {
    return false
  }
}

/**
 * Verify a decoded WebAuthn varsig completely: the assertion checks *and* the
 * signature.
 *
 * This is the function relying parties want. `verifyWebAuthnAssertion` alone
 * establishes that an assertion is well-formed and addressed to you; only the
 * signature check establishes that it came from the credential you expect.
 *
 * @param {DecodedVarsigV1} decoded
 * @param {VerificationOptions & { publicKey: Uint8Array }} options
 *   `publicKey` is the credential's public key: 32 raw bytes for Ed25519, or an
 *   uncompressed P-256 point (65 bytes, `0x04 || x || y`).
 * @returns {Promise<VerificationResult>}
 */
export async function verifyWebAuthnVarsig(decoded, options) {
  const assertionResult = await verifyWebAuthnAssertion(decoded, options)
  if (!assertionResult.valid) {
    return assertionResult
  }

  if (!options.publicKey || options.publicKey.length === 0) {
    return {
      valid: false,
      error: 'publicKey is required to verify a signature',
    }
  }

  let signedData
  try {
    signedData = await reconstructSignedData(decoded)
  } catch (error) {
    return {
      valid: false,
      error: `Could not reconstruct signed data: ${error instanceof Error ? error.message : String(error)}`,
    }
  }

  const verify =
    decoded.algorithm === 'Ed25519'
      ? verifyEd25519Signature
      : verifyP256Signature

  const signatureValid = await verify(
    signedData,
    decoded.signature,
    options.publicKey
  )

  if (!signatureValid) {
    return { ...assertionResult, valid: false, error: 'Signature is invalid' }
  }

  return assertionResult
}
