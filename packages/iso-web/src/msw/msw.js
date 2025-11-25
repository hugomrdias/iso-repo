import { setupServer } from 'msw/node'

/**
 * @returns {import('./types.ts').BrowserNodeServer}
 */
export function setup() {
  if (arguments.length > 0) {
    throw new Error(
      'setup takes no arguments use server.use(...handlers) instead'
    )
  }
  const server = setupServer()
  return {
    start: (options) => {
      server.listen(options?.node)
      return Promise.resolve(undefined)
    },
    stop: server.close.bind(server),
    resetHandlers: server.resetHandlers.bind(server),
    use: server.use.bind(server),
    restoreHandlers: server.restoreHandlers.bind(server),
    listHandlers: server.listHandlers.bind(server),
    events: server.events,
  }
}
