import { setupWorker } from 'msw/browser'

/**
 * @param {Array<import('msw').RequestHandler | import('msw').WebSocketHandler>} handlers
 */
export function setup(handlers) {
  const server = setupWorker(...handlers)
  return server
}
