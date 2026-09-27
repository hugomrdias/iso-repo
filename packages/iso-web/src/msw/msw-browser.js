import { setupWorker } from 'msw/browser'

/**
 * @typedef {object} BrowserWorker
 * @property {import('msw/browser').SetupWorker} server
 * @property {ServiceWorkerRegistration} [registration]
 * @property {Promise<unknown>} [unregistering]
 */

/**
 * @returns {import('./types.ts').BrowserNodeServer}
 */
export function setup() {
  // biome-ignore lint/complexity/noArguments: needed
  if (arguments.length > 0) {
    throw new Error(
      'setup takes no arguments use server.use(...handlers) instead'
    )
  }
  // Kept on globalThis so duplicate module instances share one worker
  const g =
    /** @type {typeof globalThis & { MSW_BROWSER_WORKER?: BrowserWorker }} */ (
      globalThis
    )
  g.MSW_BROWSER_WORKER ??= { server: setupWorker() }
  const worker = g.MSW_BROWSER_WORKER
  const server = worker.server

  return {
    start: async (options) => {
      await worker.unregistering
      const registration = await server.start(
        options?.browser ?? { quiet: true }
      )
      if (registration) {
        worker.registration = registration
      }
      return registration
    },
    stop: () => {
      server.stop()
      // msw's stop() makes the worker unregister itself asynchronously when
      // this page is its only client. A start() racing that unregistration
      // calls update() on the dying registration, which rejects unhandled with
      // "Failed to update a ServiceWorker ... Not found". Unregister here and
      // have start() wait for it so it always registers afresh.
      const { registration } = worker
      if (registration) {
        worker.registration = undefined
        worker.unregistering = registration.unregister().catch(() => false)
      }
    },
    resetHandlers: server.resetHandlers.bind(server),
    use: server.use.bind(server),
    restoreHandlers: server.restoreHandlers.bind(server),
    listHandlers: server.listHandlers.bind(server),
    events: server.events,
  }
}
