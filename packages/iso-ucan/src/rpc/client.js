import { SchemaError } from '@standard-schema/utils'

/**
 * @import {
 *   CommandsRecord,
 *   DefineClientOptions,
 *   CommandClient,
 * } from './types.js'
 */

/**
 * Define a type-safe client from a record of commands.
 *
 * The returned client exposes a `request(cmd, args)` method whose `cmd`
 * parameter is constrained to the union of `cmd` values declared by
 * `commands`, and whose `args` parameter is typed accordingly.
 *
 * @template {CommandsRecord} Commands
 * @param {Commands} commands
 * @param {DefineClientOptions} options
 * @returns {CommandClient<Commands>}
 */
export function defineClient(commands, options) {
  /** @type {Record<string, CommandsRecord[string]>} */
  const commandMap = {}
  for (const command of Object.values(commands)) {
    commandMap[command.capability.cmd] = command
  }

  return {
    request: async ({ cmd, args }) => {
      const command = commandMap[cmd]
      if (!command) {
        throw new Error(`Command not found: ${cmd}`)
      }

      const inv = await command.capability.invoke({
        args,
        iss: options.issuer,
        sub: options.audience.did,
        store: options.store,
        exp: null,
        verifierResolver: options.verifierResolver,
      })

      const response = await fetch(options.url, {
        method: 'POST',
        body: /** @type {BufferSource} */ (inv.bytes),
      })

      const data = await response.json()
      if (
        typeof data !== 'object' ||
        data === null ||
        (!('result' in data) && !('error' in data))
      ) {
        throw new Error(
          'Invalid receipt: response must include a `result` or `error` field'
        )
      }

      const validated = await command.receipt['~standard'].validate(data)
      if (validated.issues) {
        throw new SchemaError(validated.issues)
      }
      return validated.value
    },

    invoke: async ({ cmd, args }) => {
      const command = commandMap[cmd]
      if (!command) {
        throw new Error(`Command not found: ${cmd}`)
      }

      return await command.capability.invoke({
        args,
        iss: options.issuer,
        sub: options.audience.did,
        store: options.store,
        exp: null,
        verifierResolver: options.verifierResolver,
      })
    },
  }
}
