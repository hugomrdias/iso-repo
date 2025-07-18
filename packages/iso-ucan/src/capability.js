import { SchemaError } from '@standard-schema/utils'
import { Delegation } from './delegation.js'
import { Invocation } from './invocation.js'

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
   * @param {import("./types.js").CapabilityInvokeOptions<Schema>} options
   */
  async invoke(options) {
    const result = await this.schema['~standard'].validate(options.args)
    if (result.issues) {
      throw new SchemaError(result.issues)
    }

    const proofs = await options.store.chain({
      cmd: this.cmd,
      sub: options.sub.did,
      aud: options.iss.did,
    })

    return await Invocation.create({
      iss: options.iss,
      sub: options.sub,
      cmd: this.cmd,
      args: result.value,
      prf: proofs,
      exp: options.exp,
      iat: options.iat,
      nonce: options.nonce,
      cause: options.cause,
      meta: options.meta,
      aud: options.aud,
      nbf: options.nbf,
    })
  }

  /**
   *
   * @param {import("./types.js").DelegationOptions} options
   */
  delegate(options) {
    return Delegation.create({ ...options, cmd: this.cmd })
  }
}
