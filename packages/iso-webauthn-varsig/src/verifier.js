import { webcrypto } from 'iso-base/crypto'
import { parseClientDataJSON } from './decoder.js'
import { base64urlToBytes, bytesEqual } from './utils.js'

/**
 * @typedef {import('./types').ClientDataJSON} ClientDataJSON
 * @typedef {import('./types').WebAuthnDecoded} WebAuthnDecoded
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
 * Verify WebAuthn assertion components.
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
    const signCountBytes = decoded.authenticatorData.slice(33, 37)
    const signCount =
      (signCountBytes[0] << 24) |
      (signCountBytes[1] << 16) |
      (signCountBytes[2] << 8) |
      signCountBytes[3]
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

    if (options.previousSignCount !== undefined && signCount <= options.previousSignCount) {
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

  const clientDataHash = await webcrypto.subtle.digest(
    'SHA-256',
    decoded.clientDataJSON
  )

  const signedData = new Uint8Array(
    decoded.authenticatorData.length + clientDataHash.byteLength
  )
  signedData.set(decoded.authenticatorData, 0)
  signedData.set(new Uint8Array(clientDataHash), decoded.authenticatorData.length)

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

    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      publicKey,
      { name: 'Ed25519' },
      false,
      ['verify']
    )

    return await webcrypto.subtle.verify(
      'Ed25519',
      cryptoKey,
      signature,
      signedData
    )
  } catch {
    return false
  }
}

/**
 * Verify P-256 signature (requires WebCrypto API).
 *
 * @param {Uint8Array} signedData
 * @param {Uint8Array} signature
 * @param {Uint8Array} publicKey
 */
export async function verifyP256Signature(signedData, signature, publicKey) {
  try {
    if (!webcrypto?.subtle) {
      return false
    }

    const cryptoKey = await webcrypto.subtle.importKey(
      'raw',
      publicKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    )

    return await webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signature,
      signedData
    )
  } catch {
    return false
  }
}
