import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import delay from 'delay'
import { z } from 'zod'
import { createEffect, EffectRunner } from '../src/index.js'

describe('Effect rate limiting', () => {
  it('queues calls that exceed the current window', async () => {
    /** @type {number[]} */
    const starts = []
    const effect = createEffect(
      {
        name: 'limited',
        input: z.number(),
        output: z.number(),
        rateLimit: { calls: 1, per: 40 },
      },
      async ({ input }) => {
        starts.push(Date.now())
        await delay(0)
        return input
      }
    )
    const runner = new EffectRunner()

    const values = await Promise.all([
      runner.call(effect, 1),
      runner.call(effect, 2),
    ])

    assert.deepEqual(values, [1, 2])
    assert.equal(starts.length, 2)
    assert.ok(
      starts[1] - starts[0] >= 30,
      `expected second call to wait for the next window, got ${starts[1] - starts[0]}ms`
    )
  })
})
