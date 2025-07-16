import { SchemaError } from '@standard-schema/utils'
import { randomBytes } from 'iso-web/crypto'

import { Delegation } from './delegation.js'
import * as Envelope from './envelope.js'
import { Invocation, validateStructure } from './invocation.js'

/**
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 */

/**
 * @template {StandardSchemaV1} Schema
 * @typedef {Object} CapabilityOptions
 * @prop {Schema} schema
 * @prop {string} cmd
 */

/**
 * @template {StandardSchemaV1} Schema
 */
export class Capability {
  /**
   * @param {CapabilityOptions<Schema>} options
   */
  constructor(options) {
    this.schema = options.schema
    this.cmd = options.cmd
  }

  /**
   * @template {StandardSchemaV1} Schema
   * @param {CapabilityOptions<Schema>} options
   */
  static from(options) {
    return new Capability(options)
  }

  /**
   * @param {import("./types.js").InvocationOptions<Schema>} options
   */
  async invoke(options) {
    const result = await this.schema['~standard'].validate(options.args)
    if (result.issues) {
      throw new SchemaError(result.issues)
    }

    const nonce = options.nonce || randomBytes(12)
    const proofs = await options.store.resolveProofs(
      this.cmd,
      options.iss.toString()
    )

    /** @type {import("./types.js").InvocationPayload} */
    const payload = {
      iss: options.iss.toString(),
      aud: options.aud ? options.aud.toString() : options.sub.toString(),
      sub: options.sub.toString(),
      cmd: this.cmd,
      nonce,
      exp: options.exp,
      args: options.args,
      prf: proofs.map((p) => p.cid),
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

    const { signature, signaturePayload } = await Envelope.sign({
      spec: 'inv',
      signer: options.iss,
      payload,
    })

    const envelope = Envelope.encode({ signature, signaturePayload })

    /** @type {import("./types.js").DecodedEnvelope<'inv'>} */
    const decoded = {
      alg: options.iss.signatureType,
      enc: 'DAG-CBOR',
      signature,
      payload,
      spec: 'inv',
      version: Envelope.VERSION,
    }

    const invocation = Invocation.from(envelope, decoded)

    validateStructure(invocation, proofs)

    return invocation
  }

  /**
   *
   * @param {import("./types.js").DelegationOptions} options
   */
  async delegate(options) {
    const nonce = options.nonce || randomBytes(12)

    /** @type {import("./types.js").DelegationPayload} */
    const payload = {
      iss: options.iss.toString(),
      aud: options.aud.toString(),
      sub: options.sub !== null ? options.sub.toString() : options.sub,
      pol: options.pol,
      cmd: this.cmd,
      nonce,
      exp: options.exp,
    }

    if (options.nbf) {
      payload.nbf = options.nbf
    }

    if (options.meta) {
      payload.meta = options.meta
    }

    const { signature, signaturePayload } = await Envelope.sign({
      spec: 'dlg',
      signer: options.iss,
      payload,
    })

    const envelope = Envelope.encode({ signature, signaturePayload })

    /** @type {import("./types.js").DecodedEnvelope<'dlg'>} */
    const decoded = {
      alg: options.iss.signatureType,
      enc: 'DAG-CBOR',
      signature,
      payload,
      spec: 'dlg',
      version: Envelope.VERSION,
    }

    return Delegation.from(envelope, decoded)
  }
}
