import { HttpResponse, http } from 'msw'
import { assert, suite } from 'playwright-test/taps'
import { HttpError, request } from '../src/http.js'
import { setup } from '../src/msw/msw.js'

const test = suite('http retry and poll')
const server = setup()

test.before(async () => {
  await server.start()
})

test.beforeEach(() => {
  server.resetHandlers()
})

test.after(() => {
  server.stop()
})

test('should not retry by default', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/retry-default-false', () => {
      count++
      return HttpResponse.json({ error: 'failed' }, { status: 500 })
    })
  )

  const { error } = await request('https://local.dev/retry-default-false')

  if (HttpError.is(error)) {
    assert.equal(error.code, 500)
    assert.equal(count, 1)
  } else {
    assert.fail('should fail with an HTTP error')
  }
})

test('should retry configured retry status codes for retryable methods', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/retry-500', () => {
      count++
      if (count === 1) {
        return HttpResponse.json({ error: 'temporary' }, { status: 500 })
      }

      return HttpResponse.json({ data: 'ready' }, { status: 200 })
    })
  )

  const { error, result } = await request('https://local.dev/retry-500', {
    retry: {
      retries: 2,
      minTimeout: 1,
      factor: 1,
    },
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.deepEqual(await result.json(), { data: 'ready' })
    assert.equal(count, 2)
  }
})

test('should not retry methods outside the retry method list', async () => {
  let count = 0
  server.use(
    http.post('https://local.dev/post-retry', () => {
      count++
      return HttpResponse.json({ error: 'failed' }, { status: 500 })
    })
  )

  const { error } = await request.post('https://local.dev/post-retry', {
    retry: {
      retries: 2,
      minTimeout: 1,
      factor: 1,
    },
  })

  if (HttpError.is(error)) {
    assert.equal(error.code, 500)
    assert.equal(count, 1)
  } else {
    assert.fail('should fail with an HTTP error')
  }
})

test('should stop retrying when shouldRetry returns false', async () => {
  let count = 0
  let shouldRetryCount = 0
  server.use(
    http.get('https://local.dev/should-retry-false', () => {
      count++
      return HttpResponse.json({ error: 'failed' }, { status: 500 })
    })
  )

  const { error } = await request('https://local.dev/should-retry-false', {
    retry: {
      retries: 2,
      minTimeout: 1,
      factor: 1,
      shouldRetry: (ctx) => {
        shouldRetryCount++
        assert.ok(HttpError.is(ctx.error))
        assert.equal(ctx.error.code, 500)
        return false
      },
    },
  })

  if (HttpError.is(error)) {
    assert.equal(error.code, 500)
    assert.equal(count, 1)
    assert.equal(shouldRetryCount, 1)
  } else {
    assert.fail('should fail with an HTTP error')
  }
})

for (const header of ['X-RateLimit-Reset', 'X-Rate-Limit-Reset']) {
  test(
    `should treat ${header} as a Unix timestamp in seconds`,
    async () => {
      let count = 0
      const reset = Math.ceil(Date.now() / 1000) + 1
      server.use(
        http.get(`https://local.dev/rate-limit-reset/${header}`, () => {
          count++
          if (count === 1) {
            return HttpResponse.json(
              { error: 'rate limited' },
              { status: 429, headers: { [header]: String(reset) } }
            )
          }

          return HttpResponse.json({ data: 'ready' }, { status: 200 })
        })
      )

      const start = Date.now()
      const { error, result } = await request(
        `https://local.dev/rate-limit-reset/${header}`,
        {
          timeout: 5000,
          retry: {
            retries: 1,
            minTimeout: 1,
            factor: 1,
          },
        }
      )

      if (error) {
        assert.fail(error.message)
      } else {
        assert.equal(result.status, 200)
        assert.equal(count, 2)
        assert.ok(Date.now() - start >= 900)
      }
    },
    { timeout: 10_000 }
  )
}

test('should retry immediately when X-RateLimit-Reset is in the past', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/rate-limit-reset-past', () => {
      count++
      if (count === 1) {
        return HttpResponse.json(
          { error: 'rate limited' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) - 60),
            },
          }
        )
      }

      return HttpResponse.json({ data: 'ready' }, { status: 200 })
    })
  )

  const { error, result } = await request(
    'https://local.dev/rate-limit-reset-past',
    {
      timeout: 1000,
      retry: {
        retries: 1,
        minTimeout: 1,
        factor: 1,
      },
    }
  )

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.equal(count, 2)
  }
})

test(
  'should fit poll: true in the default timeout',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/poll-default-timeout', () => {
        count++
        if (count <= 6) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/poll-default-timeout',
      { poll: true }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.equal(count, 7)
    }
  },
  { timeout: 20_000 }
)

test(
  'should fit the retry backoff in the default timeout',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/retry-default-timeout', () => {
        count++
        if (count === 1) {
          return HttpResponse.json({ error: 'temporary' }, { status: 500 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/retry-default-timeout',
      { retry: { retries: 1, minTimeout: 5100 } }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.equal(count, 2)
    }
  },
  { timeout: 20_000 }
)

test('should not fail on invalid numbers when computing the default timeout', async () => {
  const fetch = async () => new Response('ok')

  for (const poll of [{ limit: Number.NaN }, { interval: -1_000_000 }]) {
    const { error, result } = await request('https://local.dev/bad-numbers', {
      fetch,
      poll,
    })
    assert.equal(error, undefined, JSON.stringify(poll))
    assert.equal(result?.status, 200)
  }

  const { error } = await request('https://local.dev/bad-numbers', {
    fetch,
    retry: { retries: -1 },
  })
  assert.equal(error?.name, 'RequestError')
})

test('should keep an explicit timeout as the total budget', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/poll-explicit-timeout', () => {
      count++
      return HttpResponse.json({ status: 'processing' }, { status: 202 })
    })
  )

  const { error } = await request('https://local.dev/poll-explicit-timeout', {
    timeout: 150,
    retry: true,
    poll: { interval: 100 },
  })

  assert.equal(error?.name, 'TimeoutError')
  assert.equal(error?.message, 'Request timed out after 150ms')
  assert.equal(count, 2)
})

test('should not wait for Retry-After when the request will not be retried', async () => {
  let count = 0
  server.use(
    http.all('https://local.dev/retry-after-no-retry', () => {
      count++
      return HttpResponse.json(
        { error: 'rate limited' },
        { status: 429, headers: { 'retry-after': '1' } }
      )
    })
  )

  /** @type {Array<[string, import('../src/types.js').RequestOptions]>} */
  const cases = [
    ['GET with retries: 0', { method: 'GET', retry: { retries: 0 } }],
    ['POST', { method: 'POST', retry: true }],
    [
      'GET with shouldRetry false',
      { method: 'GET', retry: { shouldRetry: () => false } },
    ],
  ]

  for (const [name, options] of cases) {
    count = 0
    const start = Date.now()
    const { error } = await request(
      'https://local.dev/retry-after-no-retry',
      options
    )

    assert.ok(HttpError.is(error), name)
    assert.equal(error.code, 429, name)
    assert.equal(count, 1, name)
    assert.ok(Date.now() - start < 500, `${name} waited for Retry-After`)
  }
})

test('should return the HttpError when Retry-After exceeds the timeout budget', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/retry-after-over-budget', () => {
      count++
      return HttpResponse.json(
        { error: 'rate limited' },
        { status: 429, headers: { 'retry-after': '60' } }
      )
    })
  )

  const start = Date.now()
  const { error } = await request('https://local.dev/retry-after-over-budget', {
    timeout: 1500,
    retry: true,
  })

  assert.ok(HttpError.is(error))
  assert.equal(error.code, 429)
  assert.equal(count, 1)
  assert.ok(Date.now() - start < 500)
})

test(
  'should wait for Retry-After instead of the backoff delay',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/retry-after-no-stacking', () => {
        count++
        if (count === 1) {
          return HttpResponse.json(
            { error: 'rate limited' },
            { status: 429, headers: { 'retry-after': '0.2' } }
          )
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const start = Date.now()
    const { error, result } = await request(
      'https://local.dev/retry-after-no-stacking',
      { timeout: 10_000, retry: { minTimeout: 2000 } }
    )
    const elapsed = Date.now() - start

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.equal(count, 2)
      assert.ok(elapsed >= 150, `retried after ${elapsed}ms`)
      assert.ok(elapsed < 1500, `backoff stacked: ${elapsed}ms`)
    }
  },
  { timeout: 10_000 }
)

test('should count Retry-After retries against retries', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/retry-after-bounded', () => {
      count++
      return HttpResponse.json(
        { error: 'rate limited' },
        { status: 429, headers: { 'retry-after': '0.01' } }
      )
    })
  )

  /** @type {Array<[number, number, number]>} */
  const contexts = []
  const { error } = await request('https://local.dev/retry-after-bounded', {
    retry: {
      retries: 2,
      minTimeout: 1,
      shouldRetry: (ctx) => {
        contexts.push([ctx.retriesConsumed, ctx.retriesLeft, ctx.retryDelay])
        return ctx.defaultShouldRetry
      },
    },
  })

  assert.ok(HttpError.is(error))
  assert.equal(count, 3)
  assert.deepEqual(contexts, [
    [0, 2, 10],
    [1, 1, 10],
  ])
})

test('should not retry network errors for methods outside the retry method list', async () => {
  let count = 0
  server.use(
    http.all('https://local.dev/network-error-post', () => {
      count++
      return Response.error()
    })
  )

  for (const method of ['POST', 'PATCH']) {
    count = 0
    /** @type {boolean[]} */
    const decisions = []
    const { error } = await request('https://local.dev/network-error-post', {
      method,
      retry: {
        retries: 2,
        minTimeout: 1,
        shouldRetry: (ctx) => {
          decisions.push(ctx.defaultShouldRetry)
          return ctx.defaultShouldRetry
        },
      },
    })

    assert.equal(error?.name, 'NetworkError')
    assert.equal(count, 1, method)
    assert.deepEqual(decisions, [false], method)
  }
})

test('should retry network errors for methods added to the retry method list', async () => {
  let count = 0
  server.use(
    http.post('https://local.dev/network-error-post-allowed', () => {
      count++
      return Response.error()
    })
  )

  const { error } = await request.post(
    'https://local.dev/network-error-post-allowed',
    { retry: { retries: 2, minTimeout: 1, methods: ['POST'] } }
  )

  assert.equal(error?.name, 'NetworkError')
  assert.equal(count, 3)

  count = 0
  await request.post('https://local.dev/network-error-post-allowed', {
    retry: { retries: 2, minTimeout: 1, shouldRetry: () => true },
  })
  assert.equal(count, 3)
})

test('should pass the built-in decision to shouldRetry', async () => {
  server.use(
    http.all('https://local.dev/should-retry-default', ({ request }) => {
      const status = new URL(request.url).searchParams.get('status')
      return HttpResponse.json({ error: 'failed' }, { status: Number(status) })
    })
  )

  /** @type {Array<[string, number, boolean]>} */
  const decisions = []
  for (const [method, status] of /** @type {const} */ ([
    ['GET', 500],
    ['POST', 500],
    ['GET', 400],
  ])) {
    await request(`https://local.dev/should-retry-default?status=${status}`, {
      method,
      retry: {
        retries: 2,
        minTimeout: 1,
        shouldRetry: (ctx) => {
          decisions.push([method, status, ctx.defaultShouldRetry])
          return false
        },
      },
    })
  }

  assert.deepEqual(decisions, [
    ['GET', 500, true],
    ['POST', 500, false],
    ['GET', 400, false],
  ])
})

test('should let shouldRetry override the built-in checks', async () => {
  let count = 0
  server.use(
    http.all('https://local.dev/should-retry-override', ({ request }) => {
      count++
      const status = new URL(request.url).searchParams.get('status')
      return HttpResponse.json({ error: 'failed' }, { status: Number(status) })
    })
  )

  for (const [method, status] of /** @type {const} */ ([
    ['POST', 500],
    ['GET', 400],
  ])) {
    count = 0
    const { error } = await request(
      `https://local.dev/should-retry-override?status=${status}`,
      {
        method,
        retry: { retries: 2, minTimeout: 1, shouldRetry: () => true },
      }
    )

    assert.ok(HttpError.is(error))
    assert.equal(error.code, status)
    assert.equal(count, 3, `${method} ${status}`)
  }
})

test('should let shouldRetry defer to the built-in decision', async () => {
  let count = 0
  server.use(
    http.all('https://local.dev/should-retry-defer', ({ request }) => {
      count++
      if (request.method === 'GET' && count > 1) {
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      }
      return HttpResponse.json({ error: 'failed' }, { status: 500 })
    })
  )

  /** @type {import('../src/types.js').RetryOptions} */
  const retry = {
    retries: 2,
    minTimeout: 1,
    shouldRetry: (ctx) => ctx.defaultShouldRetry,
  }

  const get = await request.get('https://local.dev/should-retry-defer', {
    retry,
  })
  assert.equal(get.result?.status, 200)
  assert.equal(count, 2)

  count = 0
  const post = await request.post('https://local.dev/should-retry-defer', {
    retry,
  })
  assert.ok(HttpError.is(post.error))
  assert.equal(count, 1)
})

test('should pass the built-in decision to shouldPoll', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/should-poll-default', () => {
      count++
      if (count < 3) {
        return HttpResponse.json({ status: 'processing' }, { status: 202 })
      }
      return HttpResponse.json({ data: 'ready' }, { status: 200 })
    })
  )

  /** @type {boolean[]} */
  const decisions = []
  const { error, result } = await request(
    'https://local.dev/should-poll-default',
    {
      poll: {
        interval: 1,
        shouldPoll: (ctx) => {
          decisions.push(ctx.defaultShouldPoll)
          return ctx.defaultShouldPoll
        },
      },
    }
  )

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.equal(count, 3)
    assert.deepEqual(decisions, [true, true, false])
  }
})

test('should let shouldPoll override the built-in checks', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/should-poll-override', () => {
      count++
      return HttpResponse.json({ data: 'ready' }, { status: 200 })
    })
  )

  const { result } = await request('https://local.dev/should-poll-override', {
    poll: { interval: 1, limit: 3, shouldPoll: () => true },
  })

  assert.equal(result?.status, 200)
  assert.equal(count, 3)
})

test(
  'should poll custom status codes with interval context',
  async () => {
    let count = 0
    /** @type {number[]} */
    const intervalAttempts = []
    /** @type {Array<unknown>} */
    const intervalBodies = []
    server.use(
      http.get('https://local.dev/poll-201', () => {
        count++
        if (count < 3) {
          return HttpResponse.json(
            { status: 'processing', count },
            { status: 201 }
          )
        }

        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request('https://local.dev/poll-201', {
      poll: {
        statusCodes: [201],
        interval: async (ctx) => {
          intervalAttempts.push(ctx.attempt)
          intervalBodies.push(await ctx.response.json())
          assert.equal(ctx.request.method, 'GET')
          assert.equal(ctx.request.url, 'https://local.dev/poll-201')
          return 1
        },
      },
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
      assert.deepEqual(intervalAttempts, [0, 1])
      assert.deepEqual(intervalBodies, [
        { status: 'processing', count: 1 },
        { status: 'processing', count: 2 },
      ])
    }
  },
  { timeout: 10_000 }
)

test(
  'should return the last pollable response when the poll limit is reached',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/poll-limit', () => {
        count++
        return HttpResponse.json(
          { status: 'processing', count },
          { status: 202 }
        )
      })
    )

    const { error, result } = await request('https://local.dev/poll-limit', {
      poll: {
        interval: 1,
        limit: 2,
      },
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 202)
      assert.deepEqual(await result.json(), { status: 'processing', count: 2 })
      assert.equal(count, 2)
    }
  },
  { timeout: 10_000 }
)

test(
  'should prefer polling when a response status is configured for retry and poll',
  async () => {
    let count = 0
    /** @type {number[]} */
    const pollAttempts = []
    server.use(
      http.get('https://local.dev/retry-and-poll-202', () => {
        count++
        if (count < 3) {
          return HttpResponse.json(
            { status: 'processing', count },
            { status: 202 }
          )
        }

        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/retry-and-poll-202',
      {
        retry: {
          statusCodes: [202],
          retries: 5,
          minTimeout: 1,
          factor: 1,
        },
        poll: {
          interval: (ctx) => {
            pollAttempts.push(ctx.attempt)
            return 1
          },
        },
      }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
      assert.deepEqual(pollAttempts, [0, 1])
    }
  },
  { timeout: 10_000 }
)

test(
  'should retry the polling operation when polling encounters a retryable error',
  async () => {
    let count = 0
    /** @type {number[]} */
    const pollAttempts = []
    server.use(
      http.get('https://local.dev/retry-poll-operation', () => {
        count++
        if (count === 1 || count === 3) {
          return HttpResponse.json(
            { status: 'processing', count },
            { status: 202 }
          )
        }

        if (count === 2) {
          return HttpResponse.json({ error: 'temporary' }, { status: 500 })
        }

        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/retry-poll-operation',
      {
        retry: {
          retries: 2,
          minTimeout: 1,
          factor: 1,
        },
        poll: {
          interval: (ctx) => {
            pollAttempts.push(ctx.attempt)
            return 1
          },
        },
      }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 4)
      assert.deepEqual(pollAttempts, [0, 0])
    }
  },
  { timeout: 10_000 }
)

/**
 * Stub fetch that answers with `statuses` in order (the last one repeats)
 * and records every response and every cancelled body.
 *
 * @param {Array<number | [number, Record<string, string>]>} statuses
 */
function trackedFetch(statuses) {
  /** @type {Response[]} */
  const responses = []
  /** @type {number[]} */
  const cancelled = []
  /** @type {typeof globalThis.fetch} */
  const fetch = () => {
    const index = responses.length
    const entry = statuses[Math.min(index, statuses.length - 1)]
    const [status, headers] = typeof entry === 'number' ? [entry, {}] : entry
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`body ${index}`))
        controller.close()
      },
      cancel() {
        cancelled.push(index)
      },
    })
    const response = new Response(body, { status, headers })
    responses.push(response)
    return Promise.resolve(response)
  }
  return { fetch, responses, cancelled }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

test('should cancel the bodies of responses discarded while polling', async () => {
  const tracked = trackedFetch([202, 202, 202, 200])
  const { error, result } = await request('https://local.dev/cancel-poll', {
    fetch: tracked.fetch,
    poll: { interval: 1 },
  })
  await tick()

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.equal(await result.text(), 'body 3')
    assert.deepEqual(tracked.cancelled, [0, 1, 2])
  }
})

test('should not cancel the last response when the poll limit is reached', async () => {
  const tracked = trackedFetch([202])
  const { result } = await request('https://local.dev/cancel-poll-limit', {
    fetch: tracked.fetch,
    poll: { interval: 1, limit: 2 },
  })
  await tick()

  assert.equal(result?.status, 202)
  assert.equal(await result?.text(), 'body 1')
  assert.deepEqual(tracked.cancelled, [0])
})

test('should cancel the bodies of failed attempts that are retried', async () => {
  const tracked = trackedFetch([503, [429, { 'retry-after': '0.01' }], 200])
  const { error, result } = await request('https://local.dev/cancel-retry', {
    fetch: tracked.fetch,
    retry: { minTimeout: 1 },
  })
  await tick()

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.equal(await result.text(), 'body 2')
    assert.deepEqual(tracked.cancelled, [0, 1])
  }
})

test('should not cancel the body of an error that is returned', async () => {
  const tracked = trackedFetch([500])
  const { error } = await request.post('https://local.dev/cancel-no-retry', {
    fetch: tracked.fetch,
    retry: { retries: 2, minTimeout: 1 },
  })
  await tick()

  assert.ok(HttpError.is(error))
  assert.equal(await error.response.text(), 'body 0')
  assert.deepEqual(tracked.cancelled, [])

  const exhausted = trackedFetch([500])
  const last = await request('https://local.dev/cancel-exhausted', {
    fetch: exhausted.fetch,
    retry: { retries: 2, minTimeout: 1 },
  })
  await tick()

  assert.ok(HttpError.is(last.error))
  assert.equal(await last.error.response.text(), 'body 2')
  assert.deepEqual(exhausted.cancelled, [0, 1])
})

test('should let hooks read responses before they are cancelled', async () => {
  const tracked = trackedFetch([500, 202, 200])
  /** @type {string[]} */
  const read = []
  const { result } = await request('https://local.dev/cancel-hooks', {
    fetch: tracked.fetch,
    retry: {
      minTimeout: 1,
      shouldRetry: async (ctx) => {
        if (HttpError.is(ctx.error)) {
          read.push(await ctx.error.response.text())
        }
        return ctx.defaultShouldRetry
      },
    },
    poll: {
      interval: 1,
      shouldPoll: async (ctx) => {
        read.push(await ctx.response.text())
        return ctx.defaultShouldPoll
      },
    },
  })
  await tick()

  assert.equal(result?.status, 200)
  assert.equal(await result?.text(), 'body 2')
  assert.deepEqual(read, ['body 0', 'body 1', 'body 2'])
  assert.ok(tracked.responses[1].bodyUsed, 'polled response was not released')
})

test('should cancel the body when onResponse throws', async () => {
  const tracked = trackedFetch([200])
  const { error } = await request('https://local.dev/cancel-on-response', {
    fetch: tracked.fetch,
    retry: { retries: 1, minTimeout: 1, shouldRetry: () => true },
    onResponse: () => {
      throw new Error('hook failed')
    },
  })
  await tick()

  assert.equal(error?.name, 'RequestError')
  assert.equal(tracked.responses.length, 2)
  assert.ok(tracked.responses.every((response) => response.bodyUsed))
})
