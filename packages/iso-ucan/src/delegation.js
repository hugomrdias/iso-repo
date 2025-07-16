import * as Envelope from './envelope.js'
import { cid, validateBasics } from './utils.js'

/**
 * @import {DelegationValidateOptions} from './types.js'
 * @import {CID} from 'multiformats'
 */

/**
 * UCAN Delegation
 */
export class Delegation {
  /**
   *
   * @param {import("./types.js").DecodedEnvelope<'dlg'>} envelope
   * @param {Uint8Array} bytes
   * @param {CID} cid
   */
  constructor(envelope, bytes, cid) {
    this.envelope = envelope
    this.bytes = bytes
    this.cid = cid
  }

  /**
   *
   * @param {Uint8Array} bytes
   * @param {import("./types.js").DecodedEnvelope<'dlg'>} [envelope]
   */
  static async from(bytes, envelope) {
    if (!envelope) {
      envelope = /** @type {typeof Envelope.decode<"dlg">} */ (Envelope.decode)(
        { envelope: bytes }
      )
    }

    if (envelope.spec !== 'dlg') {
      throw new Error(
        `Invalid envelope type. Expected: Delegation but got: ${envelope.spec}`
      )
    }

    return new Delegation(envelope, bytes, await cid(envelope))
  }

  /**
   * @param {DelegationValidateOptions} options
   */
  async validate(options) {
    const isRevokedfn = options.isRevoked ?? (async () => false)

    await validateBasics(
      this.envelope,
      options.verifyResolver,
      options.didResolveOptions
    )

    const isRevoked = await isRevokedfn(this.cid)
    if (isRevoked) {
      throw new Error('UCAN revoked')
    }

    return true
  }
}
