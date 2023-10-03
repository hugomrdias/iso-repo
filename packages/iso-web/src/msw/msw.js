import { setupServer } from 'msw/node'

/**
 * @param {import('msw').RestHandler[]} handlers
 */
export function setup(handlers) {
  const server = setupServer(...handlers)
  return {
    /**
     * @param {import('msw').StartOptions} options
     */
    start(options) {
      server.listen()
    },
    stop() {
      server.close()
    },
    ...server,
  }
}
