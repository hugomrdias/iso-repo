import * as dagCbor from '@ipld/dag-cbor'
import { equals } from 'iso-base/utils'
import { DID } from 'iso-did'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { z } from 'zod/v4'

import * as Envelope from './envelope.js'
import { parseSelector } from './policy.js'
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

export function nowInSeconds() {
  return Math.floor(Date.now() / 1000)
}

/**
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 */
export async function cid(envelope) {
  const bytes = Envelope.encode({
    signature: envelope.signature,
    // @ts-expect-error
    signaturePayload: signaturePayload(envelope),
  })
  const hash = await sha256.digest(bytes)

  return CID.create(1, dagCbor.code, hash)
}

/**
 * Assert that `bytes` is the canonical DAG-CBOR encoding of `envelope`.
 *
 * {@link cid} hashes the re-encoded envelope, and the DAG-CBOR decoder accepts
 * some non-canonical input (e.g. unsorted map keys or short floats). Without
 * this check, different byte strings would share a CID.
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 * @param {Uint8Array} bytes
 */
export function assertCanonical(envelope, bytes) {
  const encoded = Envelope.encode({
    signature: envelope.signature,
    // @ts-expect-error
    signaturePayload: signaturePayload(envelope),
  })
  if (!equals(encoded, bytes)) {
    throw new TypeError(
      'UCAN envelope is not canonical DAG-CBOR, re-encoding does not match the received bytes'
    )
  }
}

/**
 * Replay key of a UCAN: the CID of its signature payload, the exact bytes the
 * signature covers.
 *
 * Unlike {@link cid}, it does not depend on the signature bytes, so a second
 * valid signature over the same payload (for example a malleated ECDSA
 * signature) gets the same key.
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 */
export async function replayKey(envelope) {
  const hash = await sha256.digest(dagCbor.encode(signaturePayload(envelope)))

  return CID.create(1, dagCbor.code, hash).toString()
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
 * Validate the expiration of a UCAN
 *
 * @param {number | null} exp
 * @param {number} [now]
 */
export function assertExpiration(exp, now = nowInSeconds()) {
  if (exp !== null && !Number.isSafeInteger(exp)) {
    throw new TypeError(
      `UCAN expiration must be null or a safe integer. Received: ${exp}`
    )
  }

  if (exp !== null && exp < now) {
    throw new TypeError(
      `UCAN expiration must be in the future. Received: ${exp} but current time is ${now}`
    )
  }
}

/**
 * Validate an optional UCAN timestamp (e.g. `nbf` or `iat`): when present it
 * must be an integer number of seconds within ±(2^53 − 1).
 *
 * @param {unknown} value
 * @param {string} name - Field name used in the error message
 */
export function assertTimestamp(value, name) {
  if (value !== undefined && !Number.isSafeInteger(value)) {
    throw new TypeError(
      `UCAN ${name} must be a safe integer. Received: ${value}`
    )
  }
}

/**
 * Validate the not before time of a UCAN
 *
 * @param {number} [nbf]
 * @param {number} [now]
 */
export function assertNotBefore(nbf, now = nowInSeconds()) {
  if (nbf !== undefined && nbf > now) {
    throw new Error('UCAN not valid yet')
  }
}

/**
 * Validate the issuer and signature of a UCAN
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 * @param {import('iso-did').Resolver} [didResolver]
 */
export async function validateIssuerAndSignature(envelope, didResolver) {
  const issuer = await DID.fromString(envelope.payload.iss, didResolver)

  if (!isSigAndDidCompatible(issuer, envelope.alg)) {
    throw new Error(
      `UCAN issuer type mismatch: DID ${issuer.verifiableDid.type} and Signature ${envelope.alg} are not compatible`
    )
  }

  return issuer
}

/**
 * Verify the signature of a UCAN and that issuer is compatible with the signature
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 * @param {import('iso-signatures/verifiers/resolver.js').Resolver} signatureVerifierResolver
 * @param {import('iso-did').Resolver} [didResolver]
 */
export async function verifySignature(
  envelope,
  signatureVerifierResolver,
  didResolver
) {
  const issuer = await validateIssuerAndSignature(envelope, didResolver)
  try {
    const isVerified = await signatureVerifierResolver.verify({
      signature: envelope.signature,
      message: dagCbor.encode(signaturePayload(envelope)),
      did: issuer,
      type: envelope.alg,
    })

    if (!isVerified) {
      throw new Error('UCAN signature verification failed')
    }
  } catch (error) {
    throw new Error('UCAN signature verification failed', { cause: error })
  }

  return true
}

/**
 * Check if a command is covered by (equal to or a segment-wise child of) another command.
 *
 * Commands are compared by path segment, not by string prefix: `/crypto` covers
 * `/crypto` and `/crypto/sign` but not `/cryptocurrency`. The command `/` covers
 * every command.
 *
 * Both commands are expected to be valid per {@link assertIsValidCommand}, so
 * `${parent}/` is always a real segment boundary.
 *
 * @param {string} parent - The broader command, e.g. from a delegation.
 * @param {string} child - The command that must be attenuated from `parent`.
 * @returns {boolean}
 */
export function commandCovers(parent, child) {
  if (parent === '/') return child.startsWith('/')
  return child === parent || child.startsWith(`${parent}/`)
}

/**
 * Asserts that a UCAN command string is syntactically valid.
 * If the command is invalid, it throws a descriptive error.
 *
 * Rules:
 * - Commands MUST begin with a slash (/).
 * - Commands MUST be lowercase.
 * - A trailing slash MUST NOT be present, unless the command is exactly "/".
 * - Segments MUST be separated by a slash (e.g., no empty segments like "//").
 *
 * @param {string} command The command string to validate.
 * @throws {Error} If the command is syntactically invalid.
 * @returns {void} Does not return a value on success.
 */
export function assertIsValidCommand(command) {
  // Rule: Must be a string
  if (typeof command !== 'string') {
    throw new TypeError(
      `Invalid command: Input must be a string, but received type ${typeof command}`
    )
  }

  // Rule: Must begin with a slash
  if (!command.startsWith('/')) {
    throw new TypeError(
      `Invalid command: Must begin with a slash (/). Received: "${command}"`
    )
  }

  // Rule: No trailing slash, unless the command is exactly "/"
  if (command.length > 1 && command.endsWith('/')) {
    throw new TypeError(
      `Invalid command: Must not have a trailing slash. Received: "${command}"`
    )
  }

  // Rule: Must be lowercase
  if (command !== command.toLowerCase()) {
    throw new TypeError(
      `Invalid command: Must be lowercase. Received: "${command}"`
    )
  }

  // Rule: No empty segments
  if (command.includes('//')) {
    throw new TypeError(
      `Invalid command: Must not contain empty segments (e.g., "//"). Received: "${command}"`
    )
  }

  // If no error was thrown, the command is valid.
}

/**
 * Assert that the input is a Uint8Array.
 *
 * @param {unknown} nonce The value to check.
 * @throws {Error} If nonce is not a Uint8Array.
 * @returns {void}
 *
 * @example
 * ```ts twoslash
 * import { assertNonce } from 'iso-ucan/utils'
 * assertNonce(new Uint8Array([1,2,3])) // ok
 * assertNonce('foo') // throws
 * ```
 */
export function assertNonce(nonce) {
  if (!(nonce instanceof Uint8Array)) {
    throw new TypeError(
      `Invalid nonce: Expected Uint8Array, got ${Object.prototype.toString.call(nonce)}`
    )
  }
}
/**
 * Assert that args is a CBOR serializable object.
 *
 * @param {unknown} args
 */
export function assertArgs(args) {
  const parsed = cborObject.safeParse(args)
  if (parsed.error) {
    const pretty = z.prettifyError(parsed.error)

    throw new TypeError(`Invalid args: ${pretty}`, { cause: parsed.error })
  }
}

/**
 * Assert that the input is a Record<PropertyKey, unknown>.
 *
 * @param {unknown} meta - The value to check.
 * @throws {Error} If meta is not a Record<PropertyKey, unknown>.
 * @returns {void}
 */
export function assertMeta(meta) {
  if (meta) {
    const parsed = cborObject.safeParse(meta)
    if (parsed.error) {
      const pretty = z.prettifyError(parsed.error)

      throw new TypeError(`Invalid meta: ${pretty}`, { cause: parsed.error })
    }
  }
}

/**
 * ECDSA curve orders by signature algorithm, with the byte length of each
 * signature component.
 *
 * @type {Record<string, {n: bigint, size: number}>}
 */
const ECDSA_CURVES = {
  ES256: {
    n: 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n,
    size: 32,
  },
  ES384: {
    n: 0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n,
    size: 48,
  },
  ES512: {
    n: 0x01fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa51868783bf2f966b7fcc0148f709a5d03bb5c9b8899c47aebb6fb71e91386409n,
    size: 66,
  },
  ES256K: {
    n: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
    size: 32,
  },
  EIP191: {
    n: 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n,
    size: 32,
  },
}

/**
 * @param {Uint8Array} bytes
 */
function bytesToBigInt(bytes) {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  return n
}

/**
 * @param {bigint} n
 * @param {number} size
 */
function bigIntToBytes(n, size) {
  const out = new Uint8Array(size)
  for (let i = size - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}

/**
 * Signatures a signer could have issued that verify the same as `signature`.
 *
 * ECDSA signatures are malleable: `(r, s)` and `(r, n - s)` are both valid.
 * EIP-191 signatures additionally carry a recovery byte `v` that wallets
 * return as 27/28 or 0/1. Verifiers also accept EIP-155 style `v >= 35`,
 * but no signer issues those for `personal_sign`, so they are not listed.
 *
 * The result always includes `signature` itself. Other algorithms (Ed25519,
 * RSA) have a single valid signature.
 *
 * @param {import('iso-signatures/types').SignatureType} alg
 * @param {Uint8Array} signature
 * @returns {Uint8Array[]}
 */
export function equivalentSignatures(alg, signature) {
  const curve = ECDSA_CURVES[alg]
  if (!curve) {
    return [signature]
  }

  const { n, size } = curve
  const isEip191 = alg === 'EIP191'
  if (signature.length !== size * 2 + (isEip191 ? 1 : 0)) {
    return [signature]
  }

  const r = signature.subarray(0, size)
  const s = bytesToBigInt(signature.subarray(size, size * 2))
  if (s === 0n || s >= n) {
    return [signature]
  }
  const sFlipped = bigIntToBytes(n - s, size)

  if (!isEip191) {
    return [signature, new Uint8Array([...r, ...sFlipped])]
  }

  const v = signature[size * 2]
  /** @type {number} */
  let parity
  if (v === 0 || v === 27) parity = 0
  else if (v === 1 || v === 28) parity = 1
  else if (v >= 35) parity = v % 2 === 0 ? 1 : 0
  else return [signature]

  const sBytes = signature.subarray(size, size * 2)
  const candidates = [
    new Uint8Array([...r, ...sBytes, parity]),
    new Uint8Array([...r, ...sBytes, parity + 27]),
    new Uint8Array([...r, ...sFlipped, 1 - parity]),
    new Uint8Array([...r, ...sFlipped, 28 - parity]),
  ]
  return [signature, ...candidates.filter((c) => !equals(c, signature))]
}

/**
 * CIDs of every envelope that verifies the same as `envelope`: one per
 * signature in {@link equivalentSignatures}, starting with the CID of
 * `envelope` itself.
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 */
export async function equivalentCids(envelope) {
  return await Promise.all(
    equivalentSignatures(envelope.alg, envelope.signature).map((signature) =>
      cid({ ...envelope, signature })
    )
  )
}

/**
 * Assert that the input is not revoked.
 *
 * Checks every equivalent CID of the envelope (see {@link equivalentCids}),
 * so re-encoding a revoked UCAN with another valid signature does not get it
 * past a CID-based revocation list.
 *
 * @param {import('./types.js').DecodedEnvelope<PayloadSpec>} envelope
 * @param {(cid: CID) => Promise<boolean>} [isRevokedFn]
 */
export async function assertNotRevoked(envelope, isRevokedFn) {
  if (!isRevokedFn) {
    return
  }
  for (const c of await equivalentCids(envelope)) {
    if (await isRevokedFn(c)) {
      throw new Error('UCAN revoked')
    }
  }
}

/**
 * Expiration or TTL (default 300 seconds)
 *
 * @param {object} options
 * @param {number | null} [options.exp]
 * @param {number} [options.ttl]
 */
export function expOrTtl({ exp, ttl }) {
  if (exp === null) {
    return exp
  }
  const currentTimeInSeconds = Math.floor(Date.now() / 1000)
  const expiration = exp ?? currentTimeInSeconds + (ttl ?? 300)

  return expiration
}

export const cborValue =
  /** @type {typeof z.lazy<z.ZodType<import('../src/types.js').CborValue>>} */ (
    z.lazy
  )(() => {
    return z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.boolean(),
      z.bigint(),
      z.instanceof(Uint8Array),
      z.array(cborValue),
      z.record(z.string(), cborValue),
    ])
  })
export const cborObject = z.record(z.string(), cborValue)

/**
 * Policy selector, validated with {@link parseSelector}.
 *
 * @see https://github.com/ucan-wg/delegation#selectors
 */
export const selector = z.string().superRefine((value, ctx) => {
  try {
    parseSelector(value)
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: /** @type {Error} */ (error).message,
    })
  }
})

/**
 * @typedef {z.infer<typeof selector>} Selector
 */

/**
 * Statement, as defined by the spec's IPLD schema. Every statement is a tuple
 * of exact arity. Inequality values are integers or floats; large integers
 * decode from dag-cbor as `bigint`.
 *
 * @see https://github.com/ucan-wg/delegation#policy
 */
export const statement =
  /** @type {typeof z.lazy<z.ZodType<import('../src/types.js').Statement<unknown>>>} */ (
    z.lazy
    // @ts-expect-error
  )(() => {
    return z.union([
      z.tuple([
        z.union([z.literal('=='), z.literal('!=')]),
        selector,
        cborValue,
      ]), // Equality
      z.tuple([
        z.union([
          z.literal('<'),
          z.literal('<='),
          z.literal('>'),
          z.literal('>='),
        ]),
        selector,
        z.union([z.number(), z.bigint()]),
      ]), // Inequality
      z.tuple([z.literal('like'), selector, z.string()]), // Like
      z.tuple([z.literal('not'), statement]),
      z.tuple([z.literal('and'), z.array(statement)]),
      z.tuple([z.literal('or'), z.array(statement)]),
      z.tuple([z.literal('all'), selector, statement]),
      z.tuple([z.literal('any'), selector, statement]),
    ])
  })

export const policySchema = z.array(statement)

/**
 * @param {unknown} policy
 */
export function assertPolicy(policy) {
  const parsed = policySchema.safeParse(policy)
  if (parsed.error) {
    const pretty = z.prettifyError(parsed.error)

    throw new TypeError(`Invalid policy: ${pretty}`, { cause: parsed.error })
  }
}

/**
 * A type guard for Record<PropertyKey, unknown>.
 *
 * @param {unknown} value - The value to check.
 * @returns {value is Record<PropertyKey, unknown>} Whether the specified value has a runtime type of `object` and is
 * neither `null` nor an `Array`.
 */
export function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
