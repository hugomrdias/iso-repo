import crypto from 'crypto'

export const webcrypto = /** @type {Crypto} */ (crypto.webcrypto)

/**
 * Secure PRNG - Random bytes from webcrypto
 *
 * @param {number} length
 */
export function randomBytes(length = 32) {
  if (crypto.webcrypto) {
    return crypto.webcrypto.getRandomValues(new Uint8Array(length))
  } else {
    throw new Error("The environment doesn't have randomBytes function")
  }
}
