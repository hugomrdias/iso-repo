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
  verifySignature,
} from './utils.js'

/**
 * @import {DelegationValidateOptions, DIDURL, Policy, DelegationOptions, DelegationPayload} from './types.js'
 * @import {CID} from 'multiformats'
 */

/**
 * UCAN Delegation
 */
export class Delegation {
  /** @type {DIDURL} */
  iss
  /** @type {DIDURL} */
  aud
  /** @type {DIDURL | null} */
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
    this.sub = envelope.payload.sub
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
    let { bytes, envelope, didResolveOptions, signatureVerifierResolver } =
      options

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

    assertStructure(envelope.payload)

    await verifySignature(
      envelope,
      signatureVerifierResolver,
      didResolveOptions
    )

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
      aud: options.aud.toString(),
      sub: options.sub !== null ? options.sub.toString() : options.sub,
      pol: options.pol,
      cmd: options.cmd,
      nonce,
      exp: options.exp,
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
    await verifySignature(
      this.envelope,
      options.signatureVerifierResolver,
      options.didResolveOptions
    )

    assertNotBefore(this.envelope.payload.nbf)

    await assertNotRevoked(this.cid, options.isRevoked)

    return true
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

  // TODO: validate policy

  assertNonce(payload.nonce)

  assertMeta(payload.meta)
  assertExpiration(payload.exp)
}
