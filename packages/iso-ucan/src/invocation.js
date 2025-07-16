import { parse as didParse } from 'iso-did'
import * as Envelope from './envelope.js'
import { validateBasics } from './utils.js'
import { cid } from './utils.js'

/**
 * @import {InvocationValidateOptions} from './types.js'
 * @import {Delegation} from './delegation.js'
 */

/**
 * UCAN Invocation
 */
export class Invocation {
  /**
   *
   * @param {import("./types.js").DecodedEnvelope<'inv'>} envelope
   * @param {Uint8Array} bytes
   */
  constructor(envelope, bytes) {
    this.envelope = envelope
    this.bytes = bytes
  }

  /**
   *
   * @param {Uint8Array} bytes
   * @param {import("./types.js").DecodedEnvelope<'inv'>} [envelope]
   */
  static from(bytes, envelope) {
    if (!envelope) {
      envelope = /** @type {typeof Envelope.decode<"inv">} */ (Envelope.decode)(
        { envelope: bytes }
      )
    }

    if (envelope.spec !== 'inv') {
      throw new Error(
        `Invalid envelope type. Expected: Invocation but got: ${envelope.spec}`
      )
    }

    return new Invocation(envelope, bytes)
  }

  /**
   * @param {InvocationValidateOptions} options
   */
  async validate(options) {
    await validateBasics(
      this.envelope,
      options.verifyResolver,
      options.didResolveOptions
    )

    // Audience or subject must match receiver
    if (
      this.envelope.payload.aud !== options.audience.toString() &&
      this.envelope.payload.sub !== options.audience.toString()
    ) {
      throw new Error(
        `UCAN Invocation audience or subject does not match receiver. Expected: ${options.audience.toString()} but got: ${this.envelope.payload.aud}`
      )
    }

    const prfUcans = await options.resolveProofs(this.envelope.payload.prf)

    return validateStructure(this, prfUcans)
  }

  cid() {
    return cid(this.envelope)
  }
}

/**
 *
 * @param {Invocation} invocation
 * @param {Delegation[]} proofs
 */
export function validateStructure(invocation, proofs) {
  if (invocation.envelope.payload.prf.length <= 0) {
    throw new Error('UCAN Invocation proofs are required')
  }

  if (!invocation.envelope.payload.sub) {
    throw new Error('UCAN Invocation subject is required')
  }

  if (proofs.length !== invocation.envelope.payload.prf.length) {
    throw new Error("UCAN Invocation couln't resolve all proofs CIDs")
  }

  if (proofs[0].envelope.payload.iss !== proofs[0].envelope.payload.sub) {
    throw new Error('UCAN Invocation root proof is not self-signed')
  }

  for (let index = 0; index < proofs.length; index++) {
    const current = proofs[index]
    const currentAudience = didParse(current.envelope.payload.aud)
    const currentSubject = didParse(
      current.envelope.payload.sub ?? invocation.envelope.payload.sub
    )
    /** @type {Delegation | Invocation} */
    let next = proofs[index + 1]
    if (!next) {
      next = invocation
    }

    const nextIssuer = didParse(next.envelope.payload.iss)
    const nextSubject = didParse(
      next.envelope.payload.sub ?? invocation.envelope.payload.sub
    )
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

    if (!next.envelope.payload.cmd.startsWith(current.envelope.payload.cmd)) {
      throw new Error(
        `UCAN Invocation command mismatch, expected ${current.envelope.payload.cmd} to be a broader than ${next.envelope.payload.cmd}`
      )
    }
  }

  return true
}
