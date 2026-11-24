import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HttpResponse, http } from 'msw'
import { setup } from '../src/msw/msw.js'

const server = setup()

describe('msw browser', () => {
  it('should restart after stop without unhandled rejections', async () => {
    /** @type {unknown[]} */
    const rejections = []
    /** @param {PromiseRejectionEvent} event */
    const onRejection = (event) => {
      rejections.push(event.reason)
      event.preventDefault()
    }
    globalThis.addEventListener('unhandledrejection', onRejection)

    try {
      for (let i = 0; i < 20; i++) {
        await server.start()
        server.stop()
      }
      await server.start()
      server.use(
        http.get('https://msw-restart.test/ping', () =>
          HttpResponse.text('pong')
        )
      )
      const response = await fetch('https://msw-restart.test/ping')
      assert.equal(await response.text(), 'pong')
      server.stop()
      await new Promise((resolve) => setTimeout(resolve, 100))
    } finally {
      globalThis.removeEventListener('unhandledrejection', onRejection)
      server.resetHandlers()
    }

    assert.deepEqual(rejections.map(String), [])
  })
})
