import { verifyAsync } from '@noble/ed25519'

/** @type {import('../types').Verify} */
export function verify({ signature, message, did }) {
  return verifyAsync(signature, message, did.verifiableDid.publicKey)
}

/** @type {import('../types').Verifier<'Ed25519'>} */
export const verifier = {
  Ed25519: verify,
}
