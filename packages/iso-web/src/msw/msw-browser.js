import { setupWorker } from 'msw/browser'

/**
 * @typedef {object} BrowserWorker
 * @property {import('msw/browser').SetupWorker} server
 * @property {Promise<void>} [stopping]
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
      await worker.stopping
      return server.start(options?.browser ?? { quiet: true })
    },
    stop: () => {
      // The worker unregisters itself when this page was its only client, have
      // start() wait for it. Don't unregister here, pages that are still
      // controlled by the worker keep the registration alive, and registering
      // again revives it without controlling the new page.
      // Overlapping calls share the shutdown in flight, msw rejects the second
      // and an early start() would drop the listener the first waits on.
      worker.stopping ??= Promise.resolve(server.stop())
        .catch(() => undefined)
        .finally(() => {
          worker.stopping = undefined
        })
      return worker.stopping
    },
    resetHandlers: server.resetHandlers.bind(server),
    use: server.use.bind(server),
    restoreHandlers: server.restoreHandlers.bind(server),
    listHandlers: server.listHandlers.bind(server),
    events: server.events,
  }
}
