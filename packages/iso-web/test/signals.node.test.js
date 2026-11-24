import assert from 'node:assert/strict'
import { getEventListeners } from 'node:events'
import { describe, it } from 'node:test'
import { request } from '../src/http.js'
import { anySignal } from '../src/signals.js'

describe('signals', () => {
  it('should not retain listeners on input signals', () => {
    const controller = new AbortController()

    for (let i = 0; i < 20; i++) {
      anySignal([controller.signal, AbortSignal.timeout(1000)])
    }

    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  })

  it('should not leak listeners on a long-lived signal across requests', async () => {
    const controller = new AbortController()
    const fetch = async () => new Response('ok')

    for (let i = 0; i < 20; i++) {
      const { error } = await request('https://local.dev', {
        signal: controller.signal,
        timeout: false,
        fetch,
      })
      assert.ok(!error)
    }

    assert.equal(getEventListeners(controller.signal, 'abort').length, 0)
  })
})
