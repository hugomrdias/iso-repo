# iso-effect

> Isomorphic effect runner with deduplication, rate limiting and persistent caching.

## Features

- Define typed external-call effects with Standard Schema input and output validation.
- Deduplicate same-input calls while they are in flight.
- Reuse completed outputs from runner-local memory for the lifetime of an `EffectRunner`.
- Coalesce same-tick calls before applying rate limits.
- Persist opt-in caches through any `iso-kv` backend.
- Call effects from other effects through the shared runner context.

## Install

```sh
pnpm install iso-effect
```

## Usage

```js
import { KV } from 'iso-kv'
import { createEffect, EffectRunner } from 'iso-effect'
import { z } from 'zod'

const getMetadata = createEffect(
  {
    name: 'getMetadata',
    input: z.object({ id: z.string() }),
    output: z.object({
      description: z.string(),
      value: z.bigint(),
    }),
    rateLimit: { calls: 5, per: 'second' },
    cache: true,
  },
  async ({ input, context }) => {
    const response = await fetch(`https://api.example.com/${input.id}`)

    if (!response.ok) {
      context.cache = false
      throw new Error(`Metadata request failed: ${response.status}`)
    }

    context.log.info('Fetched metadata', { id: input.id })
    return response.json()
  }
)

const runner = new EffectRunner({
  kv: new KV(),
})

const metadata = await runner.call(getMetadata, { id: 'token-1' })
```

## Runner-Local Memoization

Each `EffectRunner` keeps an in-memory map of completed effect outputs. After an
effect succeeds for a given input, calling the same effect with the same parsed
input on the same runner returns the memoized output immediately. The handler is
not executed again, and the persistent cache is not read again.

```js
const runner = new EffectRunner()

await runner.call(getMetadata, { id: 'token-1' }) // runs the handler
await runner.call(getMetadata, { id: 'token-1' }) // returns from memory
```

This memory is scoped to the runner instance. Create a new `EffectRunner` to get
a fresh in-memory view, or call `runner.clear()` to drop memoized outputs. This
is separate from persistent `iso-kv` caching: runner memory lasts only as long as
the runner, while `cache: true` plus `kv` can survive across runners.

## Microtask Batching

When several calls are made before the next `await`, `iso-effect` collects them
and processes the unique inputs together on the next microtask. This makes
same-input calls share one in-flight promise and lets the rate limiter apply to
the whole group of unique cache misses.

```js
const results = await Promise.all([
  runner.call(getMetadata, { id: 'a' }),
  runner.call(getMetadata, { id: 'a' }), // shares the first call
  runner.call(getMetadata, { id: 'b' }),
])
```

With `rateLimit: { calls: 1, per: 'second' }`, the first unique miss can run in
the current window and the next unique miss waits for the next window. Calls made
after an `await` are collected in a later microtask batch.

## Rate Limits

Set `rateLimit` to `false` or omit it to disable limiting. Use `"second"`,
`"minute"`, or a number of milliseconds as the window duration.

```js
const limited = createEffect(
  {
    name: 'limited',
    input: z.string(),
    output: z.string(),
    rateLimit: { calls: 10, per: 'minute' },
  },
  ({ input }) => input
)
```

## Caching

Caching is opt-in per effect with `cache: true` and requires an `iso-kv`
instance on the runner. Cached outputs are validated against the output schema
before reuse. Invalid cached entries are deleted and the effect is executed
again.

```js
const runner = new EffectRunner({ kv: new KV() })
await runner.call(getMetadata, { id: 'token-1' })
```

Inside a handler, set `context.cache = false` to skip persistence for one
invocation:

```js
const webhook = createEffect(
  {
    name: 'webhook',
    input: z.string(),
    output: z.boolean(),
    cache: true,
  },
  async ({ input, context }) => {
    const ok = await sendWebhook(input)
    context.cache = ok
    return ok
  }
)
```

## Differences From Envio HyperIndex

`iso-effect` is inspired by Envio HyperIndex's Effect API but is a standalone
library:

- It uses Standard Schema instead of Sury.
- It uses `iso-kv` instead of HyperIndex's Postgres effect cache tables.
- It exposes lightweight runner stats instead of Prometheus metrics.
- It does not implement HyperIndex-specific preload optimization, Envio Cloud
  cache sync, or reorg rollback behavior.

## License

MIT © [Hugo Dias](http://hugodias.me)
