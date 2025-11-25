import { setupWorker } from 'msw/browser'

/** @type {import('msw/browser').SetupWorker | null} */
globalThis.MSW_BROWSER_SERVER = null

/**
 * @returns {import('./types.ts').BrowserNodeServer}
 */
export function setup() {
  if (arguments.length > 0) {
    throw new Error(
      'setup takes no arguments use server.use(...handlers) instead'
    )
  }
  if (!globalThis.MSW_BROWSER_SERVER) {
    globalThis.MSW_BROWSER_SERVER = setupWorker()
  }
  const server = globalThis.MSW_BROWSER_SERVER

  return {
    start: (options) => server.start(options?.browser ?? { quiet: true }),
    stop: server.stop.bind(server),
    resetHandlers: server.resetHandlers.bind(server),
    use: server.use.bind(server),
    restoreHandlers: server.restoreHandlers.bind(server),
    listHandlers: server.listHandlers.bind(server),
    events: server.events,
  }
}
