import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { Capability } from './capability.js'
import type { RouteHandlerOptions, RouteOptions, RouteOutput } from './types.js'

export function route<Cap extends Capability<StandardSchemaV1>, Output>(
  options: RouteOptions<Cap, Output>
): RouteOutput<Cap, Output> {
  return {
    cap: options.capability,
    fn: async ({ request, issuer, invocation, store }: RouteHandlerOptions) => {
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
