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
