import { setupWorker } from 'msw/browser'

/**
 * @param {import('msw').RequestHandler[]} handlers
 */
export function setup(handlers) {
  const server = setupWorker(...handlers)
  return server
}
