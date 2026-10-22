import { verifyAsync } from '@noble/ed25519'

/** @type {import('../types').Verify} */
export function verify({ signature, message, did, strict }) {
  // noble always rejects `S >= L`. In strict mode it also decodes `R` and the
  // public key with RFC 8032 rules instead of ZIP-215, and rejects small-order
  // public keys.
  return verifyAsync(signature, message, did.verifiableDid.publicKey, {
    zip215: !strict,
  })
}

/** @type {import('../types').Verifier<'Ed25519'>} */
export const verifier = {
  Ed25519: verify,
}
