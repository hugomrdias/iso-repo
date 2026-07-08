import { KV } from 'iso-kv'
import { assert, suite } from 'playwright-test/taps'
import { z } from 'zod'
import { createEffect, EffectRunner } from '../src/index.js'

const { test } = suite('Effect cache')

test('persists cached effect outputs in iso-kv', async () => {
  const kv = new KV()
  let calls = 0
  const effect = createEffect(
    {
      name: 'cache-hit',
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), calls: z.number() }),
      cache: true,
    },
    ({ input }) => {
      calls++
      return { id: input.id, calls }
    }
  )

  const firstRunner = new EffectRunner({ kv })
  assert.deepEqual(await firstRunner.call(effect, { id: 'a' }), {
    id: 'a',
    calls: 1,
  })

  const secondRunner = new EffectRunner({ kv })
  assert.deepEqual(await secondRunner.call(effect, { id: 'a' }), {
    id: 'a',
    calls: 1,
  })
  assert.equal(calls, 1)
  assert.equal(secondRunner.getStats(effect).cacheHits, 1)
})

test('allows a handler to opt out of caching a single call', async () => {
  const kv = new KV()
  let calls = 0
  const effect = createEffect(
    {
      name: 'cache-opt-out',
      input: z.string(),
      output: z.number(),
      cache: true,
    },
    ({ context }) => {
      calls++
      context.cache = false
      return calls
    }
  )

  assert.equal(await new EffectRunner({ kv }).call(effect, 'a'), 1)
  assert.equal(await new EffectRunner({ kv }).call(effect, 'a'), 2)
  assert.equal(calls, 2)
})

test('invalidates cached outputs that fail the output schema', async () => {
  const kv = new KV()
  let calls = 0
  const effect = createEffect(
    {
      name: 'cache-invalid',
      input: z.string(),
      output: z.number(),
      cache: true,
    },
    () => {
      calls++
      return calls
    }
  )

  assert.equal(await new EffectRunner({ kv }).call(effect, 'a'), 1)

  for await (const entry of kv.list({
    prefix: ['iso-effect', 'cache-invalid'],
  })) {
    await kv.set(entry.key, { output: 'bad' })
  }

  const runner = new EffectRunner({ kv })
  assert.equal(await runner.call(effect, 'a'), 2)
  assert.equal(runner.getStats(effect).invalidations, 1)
  assert.equal(calls, 2)
})
