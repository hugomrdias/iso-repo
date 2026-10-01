import { parse as didParse } from 'iso-did'
import { randomBytes } from 'iso-web/crypto'
import * as Envelope from './envelope.js'
import { validate } from './policy.js'
import {
  assertArgs,
  assertExpiration,
  assertIsValidCommand,
  assertMeta,
  assertNonce,
  cid,
  commandCovers,
  expOrTtl,
  nowInSeconds,
  replayKey,
  verifySignature,
} from './utils.js'

/**
 * @import {Delegation} from './delegation.js'
 * @import {CID} from 'multiformats'
 */

/**
 * UCAN Invocation
 */
export class Invocation {
  /**
   * @type {Delegation[]}
   */
  delegations

  /**
   * @type {CID}
   */
  cid

  /**
   * Key to deduplicate this invocation on: the CID of its signature payload.
   *
   * Use this instead of {@link Invocation.cid} to detect replays. The CID
   * covers the signature bytes, and some signature algorithms (e.g. ECDSA)
   * accept more than one valid signature for the same payload.
   *
   * @type {string}
   */
  replayKey

  /**
   *
   * @param {import("./types.js").DecodedEnvelope<'inv'>} envelope
   * @param {Uint8Array} bytes
   * @param {CID} cid
   * @param {Delegation[]} delegations
   * @param {string} replayKey
   */
  constructor(envelope, bytes, cid, delegations, replayKey) {
    this.envelope = envelope
    this.payload = envelope.payload
    this.bytes = bytes
    this.cid = cid
    this.delegations = delegations
    this.replayKey = replayKey
  }

  /**
   *
   * @param {import("./types.js").InvocationFromOptions} options
   */
  static async from(options) {
    const { bytes, audience } = options

    const envelope = /** @type {typeof Envelope.decode<"inv">} */ (
      Envelope.decode
    )({ envelope: bytes })

    if (envelope.spec !== 'inv') {
      throw new TypeError(
        `Invalid envelope type. Expected "inv" but got "${envelope.spec}"`
      )
    }
    // The executor is `aud` when present, otherwise `sub`
    const executor = envelope.payload.aud ?? envelope.payload.sub
    if (audience && executor !== audience.did) {
      throw new TypeError(
        `UCAN Invocation audience does not match receiver. Expected: ${audience.did} but got: ${executor ?? 'null'}`
      )
    }

    assertStructure(envelope.payload)
    await verifySignature(
      envelope,
      options.verifierResolver,
      options.didResolver
    )

    // Resolve and validate proofs
    /** @type {Delegation[]} */
    const proofs = []
    const iss = didParse(envelope.payload.iss)
    if (iss.did !== envelope.payload.sub) {
      for (const proof of envelope.payload.prf) {
        const delegation = await options.resolveProof(proof)
        // The signature covers the proof CIDs, so the resolved delegation
        // must be exactly that one (not an ECDSA-equivalent re-encoding)
        if (!delegation.cid.equals(proof)) {
          throw new Error(
            `UCAN Invocation proof CID mismatch, expected ${proof} but resolver returned ${delegation.cid}`
          )
        }
        await delegation.validate(options)
        proofs.push(delegation)
      }

      assertProofs(envelope.payload, proofs)
    }

    if (options.maxTtl !== undefined) {
      assertMaxTtl(envelope.payload.exp, options.maxTtl, options.now)
    }

    const _replayKey = await replayKey(envelope)

    // Must run last, so only fully validated invocations are recorded
    if (
      options.replayStore &&
      !(await options.replayStore.checkAndSet(_replayKey, envelope.payload.exp))
    ) {
      throw new Error(
        `UCAN Invocation replay detected, already seen ${_replayKey}`
      )
    }

    const _cid = await cid(envelope)
    return new Invocation(envelope, bytes, _cid, proofs, _replayKey)
  }

  /**
   * @param {import("./types.js").InvocationOptions} options
   */
  static async create(options) {
    const nonce = options.nonce || randomBytes(12)

    /** @type {import("./types.js").InvocationPayload} */
    const payload = {
      iss: options.iss.toString(),
      sub: options.sub,
      cmd: options.cmd,
      nonce,
      exp: expOrTtl(options),
      args: options.args,
      prf: options.prf.map((p) => p.cid),
    }
    // `aud` MUST be omitted when the executor is the subject
    if (options.aud && options.aud !== options.sub) {
      payload.aud = options.aud
    }
    if (options.cause) {
      payload.cause = options.cause
    }
    if (options.meta) {
      payload.meta = options.meta
    }
    if (options.iat) {
      payload.iat = options.iat
    }
    if (options.nbf) {
      payload.nbf = options.nbf
    }

    assertStructure(payload)

    if (options.iss.did !== options.sub) {
      for (const proof of options.prf) {
        await proof.validate(options)
      }

      assertProofs(payload, options.prf)
    }

    const { signature, signaturePayload } = await Envelope.sign({
      spec: 'inv',
      signer: options.iss,
      payload,
    })

    const bytes = Envelope.encode({ signature, signaturePayload })

    /** @type {import("./types.js").DecodedEnvelope<'inv'>} */
    const envelope = {
      alg: options.iss.signatureType,
      enc: 'DAG-CBOR',
      signature,
      payload,
      spec: 'inv',
      version: Envelope.VERSION,
    }

    return new Invocation(
      envelope,
      bytes,
      await cid(envelope),
      options.prf,
      await replayKey(envelope)
    )
  }
}

/**
 * @param {number | null} exp
 * @param {number} maxTtl
 * @param {number} [now]
 */
function assertMaxTtl(exp, maxTtl, now = nowInSeconds()) {
  if (exp === null) {
    throw new Error(
      `UCAN Invocation must expire within ${maxTtl} seconds, but has no expiration`
    )
  }
  if (exp > now + maxTtl) {
    throw new Error(
      `UCAN Invocation must expire within ${maxTtl} seconds. Received: ${exp} but current time is ${now}`
    )
  }
}

/**
 * @param {import('./types.js').InvocationPayload} payload
 */
function assertStructure(payload) {
  didParse(payload.iss)
  didParse(payload.sub)

  if (payload.aud) {
    didParse(payload.aud)
    // Spec: `aud` MUST be omitted when the executor is the subject
    if (payload.aud === payload.sub) {
      throw new TypeError(
        'UCAN Invocation audience must be omitted when it equals the subject'
      )
    }
  }

  assertIsValidCommand(payload.cmd)
  assertArgs(payload.args)
  assertMeta(payload.meta)
  assertNonce(payload.nonce)
  assertExpiration(payload.exp)
}

/**
 *
 * @param {import("./types.js").InvocationPayload} payload
 * @param {Delegation[]} proofs
 */
export function assertProofs(payload, proofs) {
  if (payload.prf.length <= 0) {
    throw new Error('UCAN Invocation proofs are required')
  }

  if (proofs.length !== payload.prf.length) {
    throw new Error("UCAN Invocation couldn't resolve all proofs CIDs")
  }

  const rootProof = proofs[0]
  const issuerDid = didParse(rootProof.iss).did
  if (issuerDid !== rootProof.sub) {
    throw new Error('UCAN Invocation root proof is not self-signed')
  }

  for (let index = 0; index < proofs.length; index++) {
    const current = proofs[index].envelope.payload

    const currentAudience = didParse(current.aud)
    const currentSubject = didParse(current.sub ?? payload.sub)

    if (!validate(payload.args, current.pol)) {
      throw new Error(
        `UCAN Invocation invalid arguments, expected ${JSON.stringify(payload.args)} to be valid for policy ${JSON.stringify(current.pol)} `
      )
    }

    const nextProof = proofs[index + 1]

    /** @type {import("./types.js").Payload} */
    let next
    if (nextProof) {
      next = nextProof.envelope.payload
    } else {
      next = payload // checks against the invocation payload
    }

    const nextIssuer = didParse(next.iss)
    const nextSubject = didParse(next.sub ?? payload.sub)
    if (nextIssuer.did !== currentAudience.did) {
      throw new Error(
        `UCAN Invocation principal alignment mismatch, expected ${currentAudience.toString()} but got ${nextIssuer.toString()}`
      )
    }

    if (nextSubject.did !== currentSubject.did) {
      throw new Error(
        `UCAN Invocation subject alignment mismatch, expected ${currentSubject.toString()} but got ${nextSubject.toString()}`
      )
    }

    if (!commandCovers(current.cmd, next.cmd)) {
      throw new Error(
        `UCAN Invocation command mismatch, expected ${current.cmd} to cover ${next.cmd}`
      )
    }
  }

  return true
}
