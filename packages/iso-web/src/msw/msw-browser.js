import { setupWorker } from 'msw'

/**
 * @param {import('msw').RestHandler[]} handlers
 */
export function setup(handlers) {
  const server = setupWorker(...handlers)
  return server
}
