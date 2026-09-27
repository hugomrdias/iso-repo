import { setupWorker } from 'msw/browser'

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
    /** @type {typeof globalThis & { MSW_BROWSER_SERVER?: import('msw/browser').SetupWorker }} */ (
      globalThis
    )
  g.MSW_BROWSER_SERVER ??= setupWorker()
  const server = g.MSW_BROWSER_SERVER

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
