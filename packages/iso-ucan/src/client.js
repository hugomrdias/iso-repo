/**
 * @import {InferProtocol, RouteOutput, StandardSchemaV1} from './types'
 * @import {Capability} from './capability'
 */

/**
 * @template {InferProtocol<Record<string, RouteOutput<Capability<StandardSchemaV1>, unknown>>>} T
 * @param {import('./types.js').ClientOptions} options
 * @returns {import('./types.js').RouterClient<T>}
 */
export function createClient(options) {
  const { url, capabilities } = options

  // Create a map of capabilities by their `cmd` property
  const capabilityMap = Object.fromEntries(
    capabilities.map((cap) => [cap.cmd, cap])
  )
  return {
    request: async (/** @type {string} */ cmd, /** @type {any} */ args) => {
      const capability = capabilityMap[cmd]

      if (!capability) {
        throw new Error(`Capability not found: ${cmd}`)
      }

      const inv = await capability.invoke({
        args,
        iss: options.issuer,
        sub: options.audience.did,
        store: options.store,
        exp: null,
      })

      const response = await fetch(url, {
        method: 'POST',
        body: inv.bytes,
      })
      return response.json()
    },
  }
}
