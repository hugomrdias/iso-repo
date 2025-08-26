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
  expOrTtl,
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
   *
   * @param {import("./types.js").DecodedEnvelope<'inv'>} envelope
   * @param {Uint8Array<ArrayBuffer>} bytes
   * @param {CID} cid
   * @param {Delegation[]} delegations
   */
  constructor(envelope, bytes, cid, delegations) {
    this.envelope = envelope
    this.payload = envelope.payload
    this.bytes = bytes
    this.cid = cid
    this.delegations = delegations
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
    // Audience or subject must match receiver
    if (
      envelope.payload.aud !== audience.did &&
      envelope.payload.sub !== audience.did
    ) {
      throw new TypeError(
        `UCAN Invocation audience or subject does not match receiver. Expected: ${audience.did} but got: ${envelope.payload.aud ?? envelope.payload.sub ?? 'null'}`
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
        await delegation.validate(options)
        proofs.push(delegation)
      }

      assertProofs(envelope.payload, proofs)
    }

    const _cid = await cid(envelope)
    return new Invocation(envelope, bytes, _cid, proofs)
  }

  /**
   * @param {import("./types.js").InvocationOptions} options
   */
  static async create(options) {
    const nonce = options.nonce || randomBytes(12)

    /** @type {import("./types.js").InvocationPayload} */
    const payload = {
      iss: options.iss.toString(),
      aud: options.aud ? options.aud : options.sub,
      sub: options.sub,
      cmd: options.cmd,
      nonce,
      exp: expOrTtl(options),
      args: options.args,
      prf: options.prf.map((p) => p.cid),
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

    return new Invocation(envelope, bytes, await cid(envelope), options.prf)
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

  const lastProof = proofs[proofs.length - 1]
  const issuerDid = didParse(lastProof.envelope.payload.iss).did
  if (issuerDid !== lastProof.envelope.payload.sub) {
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
      next = payload
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

    if (!next.cmd.startsWith(current.cmd)) {
      throw new Error(
        `UCAN Invocation command mismatch, expected ${current.cmd} to be a broader than ${next.cmd}`
      )
    }
  }

  return true
}
