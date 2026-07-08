import { assert, suite } from 'playwright-test/taps'
import { z } from 'zod'
import { createEffect, EffectRunner } from '../src/index.js'

const { test } = suite('EffectRunner')

/**
 * @param {Promise<unknown>} promise
 * @param {string} message
 */
async function assertRejects(promise, message) {
  try {
    await promise
    assert.fail(message)
  } catch (error) {
    assert.ok(error instanceof Error)
  }
}

test('calls an effect with validated input and output', async () => {
  const effect = createEffect(
    {
      name: 'metadata',
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string(), value: z.number() }),
    },
    ({ input }) => ({ id: input.id, value: 1 })
  )

  const runner = new EffectRunner()

  assert.deepEqual(await runner.call(effect, { id: 'a' }), {
    id: 'a',
    value: 1,
  })
})

test('deduplicates in-flight calls and memoizes completed outputs', async () => {
  let calls = 0
  const effect = createEffect(
    {
      name: 'dedup',
      input: z.object({ id: z.string() }),
      output: z.number(),
    },
    async () => {
      calls++
      await Promise.resolve()
      return calls
    }
  )
  const runner = new EffectRunner()

  const [first, second] = await Promise.all([
    runner.call(effect, { id: 'a' }),
    runner.call(effect, { id: 'a' }),
  ])

  assert.equal(first, 1)
  assert.equal(second, 1)
  assert.equal(calls, 1)
  assert.equal(await runner.call(effect, { id: 'a' }), 1)
  assert.equal(calls, 1)
  assert.equal(runner.getStats(effect).dedupHits, 1)
  assert.equal(runner.getStats(effect).memoHits, 1)
})

test('allows nested effect calls through the same runner', async () => {
  const child = createEffect(
    {
      name: 'child',
      input: z.number(),
      output: z.number(),
    },
    ({ input }) => input * 2
  )
  const parent = createEffect(
    {
      name: 'parent',
      input: z.number(),
      output: z.number(),
    },
    async ({ input, context }) => {
      const doubled = await context.effect(child, input)
      return doubled + 1
    }
  )
  const runner = new EffectRunner()

  assert.equal(await runner.call(parent, 2), 5)
  assert.equal(await runner.call(child, 2), 4)
  assert.equal(runner.getStats(child).memoHits, 1)
})

test('rejects invalid input and output', async () => {
  const inputEffect = createEffect(
    {
      name: 'invalid-input',
      input: z.object({ id: z.string() }),
      output: z.string(),
    },
    ({ input }) => input.id
  )
  const outputEffect = createEffect(
    {
      name: 'invalid-output',
      input: z.string(),
      output: z.number(),
    },
    () => /** @type {number} */ (/** @type {unknown} */ ('not a number'))
  )
  const runner = new EffectRunner()

  await assertRejects(
    // @ts-expect-error exercising runtime validation
    runner.call(inputEffect, { id: 1 }),
    'input validation should reject'
  )
  await assertRejects(
    runner.call(outputEffect, 'a'),
    'output validation should reject'
  )
})
