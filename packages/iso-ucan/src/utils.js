import * as dagCbor from '@ipld/dag-cbor'
import { DID } from 'iso-did'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { z } from 'zod/v4'

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
 * Validate the expiration of a UCAN
 *
 * @param {number | null} exp
 */
export function assertExpiration(exp) {
  const now = nowInSeconds()
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
 * Validate the not before time of a UCAN
 *
 * @param {number} [nbf]
 */
export function assertNotBefore(nbf) {
  if (nbf && nbf > nowInSeconds()) {
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
  const isVerified = await signatureVerifierResolver.verify({
    signature: envelope.signature,
    message: /** @type {Uint8Array<ArrayBuffer>} */ (
      dagCbor.encode(signaturePayload(envelope))
    ),
    did: issuer,
    type: envelope.alg,
  })

  if (!isVerified) {
    throw new Error('UCAN signature verification failed')
  }

  return true
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
 * Assert that the input is not revoked.
 *
 * @param {import('multiformats/cid').CID} cid
 * @param {(cid: CID) => Promise<boolean>} [isRevokedFn]
 */
export async function assertNotRevoked(cid, isRevokedFn) {
  isRevokedFn = isRevokedFn ?? (async () => false)
  const isRevoked = await isRevokedFn(cid)
  if (isRevoked) {
    throw new Error('UCAN revoked')
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

export const selector = z.union([
  z.literal('.'),
  z.templateLiteral([z.literal('.'), z.string()]),
])

/**
 * @typedef {z.infer<typeof selector>} Selector
 */

/**
 * Statement
 */
export const statement =
  /** @type {typeof z.lazy<z.ZodType<import('../src/types.js').Statement<unknown>>>} */ (
    z.lazy
    // @ts-ignore
  )(() => {
    return z.union([
      z.tuple([
        z.union([z.literal('=='), z.literal('!=')]),
        selector,
        z.unknown(),
      ]), // Equality
      z.tuple([
        z.union([
          z.literal('<'),
          z.literal('<='),
          z.literal('>'),
          z.literal('>='),
        ]),
        selector,
        z.number(),
      ]), // Inequality
      z.tuple([z.literal('like'), selector, z.string()]), // Like
      z.tuple([z.literal('not'), statement]),
      z.tuple([z.literal('and'), z.array(statement)]),
      z.tuple([z.literal('or'), z.array(statement)]),
      z.tuple([z.literal('all'), z.string(), statement]),
      z.tuple([z.literal('any'), z.string(), statement]),
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
