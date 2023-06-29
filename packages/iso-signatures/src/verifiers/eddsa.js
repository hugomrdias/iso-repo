/* eslint-disable unicorn/numeric-separators-style */
import { verifyAsync } from '@noble/ed25519'

/** @type {import('../types').Verify} */
export function verify({ signature, message, publicKey }) {
  return verifyAsync(signature, message, publicKey)
}

/** @type {import('../types').Verifier<'EdDSA'>} */
export const verifier = {
  EdDSA: verify,
}
