import { setupServer } from 'msw/node'

/**
 * @param {Array<import('msw').RequestHandler | import('msw').WebSocketHandler>} handlers
 */
export function setup(handlers) {
  const server = setupServer(...handlers)
  return {
    /**
     * @param {import('msw/browser').StartOptions} _options
     */
    start(_options) {
      server.listen()
      return Promise.resolve()
    },
    stop() {
      server.close()
    },
    resetHandlers() {
      server.resetHandlers()
    },
    /**
     * @param {Array<import('msw').RequestHandler | import('msw').WebSocketHandler>} handlers
     */
    use(...handlers) {
      server.use(...handlers)
    },
  }
}
