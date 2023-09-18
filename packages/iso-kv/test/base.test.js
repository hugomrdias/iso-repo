import { suite, assert } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { baseTests, baseSchema } from './base.js'

import { z } from 'zod'

/** @type {KV<typeof baseSchema>} */
const kv = new KV({
  schema: baseSchema,
  // @ts-ignore
  store: new Map(),
})

baseTests(kv, suite('Map'))

const test = suite('Misc')

test('should validate object schema', async () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  })

  /** @type {KV<typeof schema>} */
  const kv = new KV({
    schema,
    // @ts-ignore
    store: new Map(),
  })

  // @ts-expect-error - testing invalid type
  await assert.rejects(kv.set('name', 1), {
    name: 'ZodError',
  })
})

test('should validate complex object schema', async () => {
  const schema = z.object({
    name: z.string(),
    more: z.object({
      name: z.string(),
      more: z.number(),
    }),
  })

  /** @type {KV<typeof schema>} */
  const kv = new KV({
    schema,
    // @ts-ignore
    store: new Map(),
  })

  // @ts-expect-error - testing invalid type
  await assert.rejects(kv.set('more', { name: 1 }), {
    name: 'ZodError',
  })
})

test('should work without validation but with types', async () => {
  // eslint-disable-next-line no-unused-vars
  const schema = z.object({
    name: z.string(),
    more: z.object({
      name: z.string(),
      more: z.number(),
    }),
  })

  /** @type {KV<typeof schema>} */
  const kv = new KV({
    // @ts-ignore
    store: new Map(),
  })

  assert.equal(await kv.set('name', 'yo'), true)
  assert.equal(await kv.get('name'), 'yo')
})
