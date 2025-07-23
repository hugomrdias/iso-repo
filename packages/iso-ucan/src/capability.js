import { SchemaError } from '@standard-schema/utils'
import { Delegation } from './delegation.js'
import { Invocation } from './invocation.js'

/**
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 */

/**
 * @template {StandardSchemaV1} Schema
 * @template {string} [Cmd=string]
 * @typedef {Object} CapabilityOptions
 * @prop {Schema} schema
 * @prop {Cmd} cmd
 */

/**
 * @template {StandardSchemaV1} Schema
 * @template {string} [Cmd=string]
 */
export class Capability {
  /**
   * @param {CapabilityOptions<Schema, Cmd>} options
   */
  constructor(options) {
    this.schema = options.schema
    this.cmd = options.cmd
  }

  /**
   * @template {StandardSchemaV1} Schema
   * @template {string} [Cmd=string]
   * @param {CapabilityOptions<Schema, Cmd>} options
   */
  static from(options) {
    return new Capability(options)
  }

  /**
   * @param {StandardSchemaV1.InferInput<Schema>} args
   */
  async validate(args) {
    const result = await this.schema['~standard'].validate(args)
    return result
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
      sub: options.sub,
      aud: options.iss.did,
    })

    return await Invocation.create({
      ...options,
      args: result.value,
      cmd: this.cmd,
      prf: proofs,
    })
  }

  /**
   *
   * @param {import("./types.js").CapabilityDelegateOptions} options
   */
  delegate(options) {
    return Delegation.create({ ...options, cmd: this.cmd })
  }
}
