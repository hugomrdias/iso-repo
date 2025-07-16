import * as dagCbor from '@ipld/dag-cbor'
import { DID } from 'iso-did'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

import * as Envelope from './envelope.js'
import * as varsig from './varsig.js'

/**
 * @import {PayloadSpec} from './types.js'
 */

/**
 * Create the signature payload for a given envelope
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 * @returns
 */
export function signaturePayload(envelope) {
  const payloadTag = /** @type {import('./types.js').PayloadTag} */ (
    `ucan/${envelope.spec}@${envelope.version}`
  )
  const payload = {
    h: varsig.encode({
      enc: envelope.enc,
      alg: envelope.alg,
    }),
    [payloadTag]: envelope.payload,
  }
  return payload
}

/**
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 */
export async function cid(envelope) {
  const bytes = Envelope.encode({
    signature: envelope.signature,
    // @ts-ignore
    signaturePayload: signaturePayload(envelope),
  })
  const hash = await sha256.digest(bytes)

  return CID.create(1, dagCbor.code, hash)
}

/**
 * Check if a DID and signature type are compatible
 *
 * @param {import('iso-did/types').VerifiableDID} did
 * @param {import('iso-signatures/types').SignatureType} sigType
 */
export function isSigAndDidCompatible(did, sigType) {
  if (did.verifiableDid.type === 'Ed25519' && sigType === 'Ed25519') {
    return true
  }

  if (did.verifiableDid.type === 'secp256k1' && sigType === 'ES256K') {
    return true
  }

  if (did.verifiableDid.type === 'P-256' && sigType === 'ES256') {
    return true
  }

  if (did.verifiableDid.type === 'P-384' && sigType === 'ES384') {
    return true
  }

  if (did.verifiableDid.type === 'P-521' && sigType === 'ES512') {
    return true
  }

  if (did.verifiableDid.type === 'RSA' && sigType === 'RS256') {
    return true
  }
  if (did.verifiableDid.type === 'secp256k1' && sigType === 'EIP191') {
    return true
  }

  return false
}

/**
 * Validate the basics of a UCAN envelope
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 * @param {import('iso-signatures/verifiers/resolver.js').Resolver} verifyResolver
 * @param {import('iso-did/types').ResolveOptions} [didResolveOptions]
 */
export async function validateBasics(
  envelope,
  verifyResolver,
  didResolveOptions
) {
  const nowInSeconds = Math.floor(Date.now() / 1000)

  // Time bounds
  if (envelope.payload.exp && envelope.payload.exp < nowInSeconds) {
    throw new Error('UCAN expired')
  }

  if (envelope.payload.nbf && envelope.payload.nbf > nowInSeconds) {
    throw new Error('UCAN not yet valid')
  }

  // Issuer must be compatible with signature
  const issuer = await DID.fromString(envelope.payload.iss, didResolveOptions)
  if (!isSigAndDidCompatible(issuer, envelope.alg)) {
    throw new Error(
      `UCAN issuer type mismatch: DID ${issuer.verifiableDid.type} and Signature ${envelope.alg} are not compatible`
    )
  }

  const isVerified = await verifyResolver.verify({
    signature: envelope.signature,
    message: dagCbor.encode(signaturePayload(envelope)),
    did: issuer,
    type: envelope.alg,
  })

  if (!isVerified) {
    throw new Error('UCAN signature verification failed')
  }

  return true
}
