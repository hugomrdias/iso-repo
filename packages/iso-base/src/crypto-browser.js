export const webcrypto = globalThis.crypto

/**
 * Secure PRNG - Random bytes from webcrypto
 *
 * @param {number} length
 */
export function randomBytes(length = 32) {
  if (globalThis.crypto) {
    return globalThis.crypto.getRandomValues(new Uint8Array(length))
  } else {
    throw new Error("The environment doesn't have randomBytes function")
  }
}
