import { SchemaError } from '@standard-schema/utils'
import { parse as didParse } from 'iso-did'
import { Delegation } from './delegation.js'
import { Invocation } from './invocation.js'

/**
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 * @import {CapabilityOptions, CapabilityDelegateOptions} from './types.js'
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
    this.isRevoked = options.isRevoked
    this.didResolver = options.didResolver
    this.verifierResolver = options.verifierResolver
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
   * Invoke this capability
   *
   * @param {import("./types.js").CapabilityInvokeOptions<Schema>} options
   * @returns {Promise<Invocation>}
   */
  async invoke(options) {
    const result = await this.schema['~standard'].validate(options.args)
    if (result.issues) {
      throw new SchemaError(result.issues)
    }

    /** @type {Delegation[]} */
    let proofs = []
    const iss = didParse(options.iss.did)
    if (iss.did !== options.sub) {
      proofs = await options.store.chain({
        cmd: this.cmd,
        sub: options.sub,
        aud: options.iss.did,
        args: result.value,
      })
    }
    return await Invocation.create({
      ...options,
      args: result.value,
      cmd: this.cmd,
      prf: proofs,
      verifierResolver: this.verifierResolver,
      didResolver: this.didResolver,
      isRevoked: this.isRevoked,
    })
  }

  /**
   * Create a delegation for this capability
   *
   * @param {CapabilityDelegateOptions<Schema>} options
   * @returns {Promise<Delegation>}
   */
  async delegate(options) {
    const dlg = await Delegation.create({ ...options, cmd: this.cmd })
    await options.store.add([dlg])
    return dlg
  }
}
