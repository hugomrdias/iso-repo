import { Capability } from '../capability.js'

/**
 * @import {
 *   CommandOptions,
 *   CommandOutput,
 * } from './types.js'
 * @import {StandardSchemaV1} from '@standard-schema/spec'
 */

/**
 * @template {StandardSchemaV1} Args
 * @template {string} Cmd
 * @template {StandardSchemaV1} ReceiptSchema
 * @param {CommandOptions<Args, Cmd, ReceiptSchema>} options
 * @returns {CommandOutput<Args, Cmd, ReceiptSchema>}
 */
export function defineCommand(options) {
  return {
    capability: /** @type {Capability<Args, Cmd>} */ (
      Capability.from({
        schema: options.args,
        cmd: options.cmd,
      })
    ),
    receipt: options.receipt,
  }
}
