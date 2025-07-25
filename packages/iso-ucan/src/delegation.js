import { base64pad } from 'iso-base/rfc4648'
import { parse as didParse } from 'iso-did'
import { randomBytes } from 'iso-web/crypto'
import * as Envelope from './envelope.js'
import {
  assertExpiration,
  assertIsValidCommand,
  assertMeta,
  assertNonce,
  assertNotBefore,
  assertNotRevoked,
  cid,
  expOrTtl,
  verifySignature,
} from './utils.js'

/**
 * @import {DelegationValidateOptions, Policy, DelegationOptions, DelegationPayload, DID, DIDURL} from './types.js'
 * @import {CID} from 'multiformats'
 */

/**
 * UCAN Delegation
 */
export class Delegation {
  /** @type {DIDURL} */
  iss
  /** @type {DID} */
  aud
  /** @type {DID | null} */
  sub
  /** @type {string} */
  cmd
  /** @type {Policy} */
  pol
  /** @type {number | undefined} */
  nbf
  /** @type {Uint8Array} */
  nonce
  /** @type {Record<string, unknown> | undefined} */
  meta
  /** @type {number | null} */
  exp

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

    this.iss = envelope.payload.iss
    this.aud = envelope.payload.aud
    this.sub = envelope.payload.sub ? envelope.payload.sub : null
    this.cmd = envelope.payload.cmd
    this.pol = envelope.payload.pol
    this.exp = envelope.payload.exp
    this.nbf = envelope.payload.nbf
    this.nonce = envelope.payload.nonce
    this.meta = envelope.payload.meta
  }

  /**
   *
   * @param {import("./types.js").DelegationFromOptions} options
   */
  static async from(options) {
    const { bytes, didResolver: didResolveOptions, verifierResolver } = options

    const envelope = /** @type {typeof Envelope.decode<"dlg">} */ (
      Envelope.decode
    )({ envelope: bytes })

    if (envelope.spec !== 'dlg') {
      throw new Error(
        `Invalid envelope type. Expected: Delegation but got: ${envelope.spec}`
      )
    }

    assertStructure(envelope.payload)

    await verifySignature(envelope, verifierResolver, didResolveOptions)

    const _cid = await cid(envelope)
    await assertNotRevoked(_cid, options.isRevoked)

    return new Delegation(envelope, bytes, _cid)
  }

  /**
   *
   * @param {DelegationOptions & { cmd: string }} options
   */
  static async create(options) {
    const nonce = options.nonce || randomBytes(12)

    /** @type {DelegationPayload} */
    const payload = {
      iss: options.iss.toString(),
      aud: options.aud,
      sub: options.sub ? options.sub : null,
      pol: options.pol,
      cmd: options.cmd,
      nonce,
      exp: expOrTtl(options),
    }

    if (options.nbf) {
      payload.nbf = options.nbf
    }

    if (options.meta) {
      payload.meta = options.meta
    }

    assertStructure(payload)

    const { signature, signaturePayload } = await Envelope.sign({
      spec: 'dlg',
      signer: options.iss,
      payload,
    })

    const bytes = Envelope.encode({ signature, signaturePayload })

    /** @type {import("./types.js").DecodedEnvelope<'dlg'>} */
    const envelope = {
      alg: options.iss.signatureType,
      enc: 'DAG-CBOR',
      signature,
      payload,
      spec: 'dlg',
      version: Envelope.VERSION,
    }

    return new Delegation(envelope, bytes, await cid(envelope))
  }

  /**
   * @param {DelegationValidateOptions} options
   */
  async validate(options) {
    assertStructure(this.envelope.payload)
    assertNotBefore(this.envelope.payload.nbf)
    await verifySignature(
      this.envelope,
      options.verifierResolver,
      options.didResolver
    )
    await assertNotRevoked(this.cid, options.isRevoked)

    return true
  }

  toString() {
    return base64pad.encode(this.bytes)
  }
  toJSON() {
    return {
      token: this.toString(),
      cid: this.cid.toString(),
      envelope: {
        payload: {
          iss: this.iss.toString(),
          aud: this.aud.toString(),
          sub: this.sub ? this.sub.toString() : null,
          cmd: this.cmd,
          pol: this.pol,
          exp: this.exp,
          nbf: this.nbf,
          nonce: base64pad.encode(this.nonce),
          meta: this.meta,
        },
        signature: base64pad.encode(this.envelope.signature),
        alg: this.envelope.alg,
        enc: this.envelope.enc,
        spec: this.envelope.spec,
        version: this.envelope.version,
      },
    }
  }
}

/**
 *
 * @param {import('./types.js').DelegationPayload} payload
 */
function assertStructure(payload) {
  didParse(payload.iss)
  didParse(payload.aud)

  if (payload.sub !== null) {
    didParse(payload.sub)
  }

  assertIsValidCommand(payload.cmd)
  assertExpiration(payload.exp)
  assertNonce(payload.nonce)

  // assertPolicy(payload.pol)

  assertMeta(payload.meta)
}
