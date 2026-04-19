/**
 * Hardcoded development keys and a verifier resolver.
 *
 * The server's signer is the audience for every invocation; the CLI's signer
 * is the issuer. Both keys are checked into source on purpose — this is a
 * local dev demo, not a production deployment.
 */
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { verify as verifyEd25519 } from 'iso-signatures/verifiers/eddsa.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'

/** Server signer — used as the invocation audience and to sign delegations. */
export const serverSigner = await EdDSASigner.import(
  'gCZx8eS6eh6NR1yuz4Ru78uCFGwr3ORwuAHzhabEu0zM/g=='
)

/** CLI signer — used as the invocation issuer. */
export const cliSigner = await EdDSASigner.import(
  'gCa9UfZv+yI5/rvUIt21DaGI7EZJlzFO1uDc5AyJ30c6/w=='
)

/** Verifier resolver shared by both server and CLI. */
export const verifierResolver = new Resolver({
  Ed25519: verifyEd25519,
})
