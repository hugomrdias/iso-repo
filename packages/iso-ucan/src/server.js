// import type { StandardSchemaV1 } from '@standard-schema/spec'
// import type { Capability } from './capability.js'
// import type { RouteHandlerOptions, RouteOptions, RouteOutput } from './types.js'

/**
 * @import { RouteOutput, StandardSchemaV1, RouteOptions, RouteHandlerOptions} from './types'
 * @import {Capability} from './capability'
 */

/**
 * Workaround to make imports types work
 * @template {Capability<StandardSchemaV1, string>} T
 * @template Output
 * @typedef {Object} DELETE_ME
 * @prop {string} url
 * @prop {Capability<StandardSchemaV1, string>[]} capabilities
 * @prop {RouteOutput<T, Output>} router
 * @prop {RouteOptions<T, Output>} options
 * @prop {RouteHandlerOptions} routerClient
 */

/**
 * @template Output
 * @template {Capability<StandardSchemaV1>} Cap
 * @param {RouteOptions<Cap, Output>} options
 * @returns {RouteOutput<Cap, Output>}
 */
export function route(options) {
  return {
    cap: options.capability,
    fn: async (
      /** @type {RouteHandlerOptions} */ { request, issuer, invocation, store }
    ) => {
      const { capability, handler } = options

      const args = await capability.validate(invocation.payload.args)
      if (args.issues) {
        throw new Error(args.issues.map((issue) => issue.message).join(', '))
      }

      // TODO: handle failure
      const result = await handler({ args: args.value, store })

      return result
    },
  }
}
