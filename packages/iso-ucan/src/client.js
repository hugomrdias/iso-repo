/**
 * @import {InferProtocol, RouteOutput, StandardSchemaV1, ClientOptions, RouterClient} from './types'
 * @import {Capability} from './capability'
 */

/**
 * Workaround to make imports types work
 * @template {{ cmd: string; in: unknown; out: unknown; }} T
 * @typedef {Object} DELETE_ME
 * @prop {string} url
 * @prop {Capability<StandardSchemaV1, string>[]} capabilities
 * @prop {InferProtocol<Record<string, RouteOutput<Capability<StandardSchemaV1>, unknown>>>} router
 * @prop {ClientOptions} options
 * @prop {RouterClient<T>} routerClient
 */

/**
 * @template {InferProtocol<Record<string, RouteOutput<Capability<StandardSchemaV1>, unknown>>>} T
 * @param {ClientOptions} options
 * @returns {RouterClient<T>}
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
