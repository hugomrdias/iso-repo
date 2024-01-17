import { setupServer } from 'msw/node'

/**
 * @param {import('msw').RequestHandler[]} handlers
 */
export function setup(handlers) {
  const server = setupServer(...handlers)
  return {
    /**
     * @param {import('msw/browser').StartOptions} options
     */
    async start(options) {
      server.listen()
    },
    stop() {
      server.close()
    },
    resetHandlers() {
      server.resetHandlers()
    },
    /**
     * @param {import('msw').RequestHandler[]} handlers
     */
    use(...handlers) {
      server.use(...handlers)
    },
  }
}
