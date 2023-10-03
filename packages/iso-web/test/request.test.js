import { assert, suite } from 'playwright-test/taps'
import { rest } from 'msw'
import { HttpError, request } from '../src/http.js'
import { setup } from '../src/msw/msw.js'

const test = suite('request')
const server = setup([
  rest.get('https://local.dev', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ hello: 'world' }))
  }),
  rest.get('https://local.dev/error', (req, res, ctx) => {
    const params = Object.fromEntries(req.url.searchParams)
    return res(ctx.status(Number(params.status)), ctx.text(params.text))
  }),
  rest.get('https://local.dev/error-json', (req, res, ctx) => {
    const params = Object.fromEntries(req.url.searchParams)
    return res(ctx.status(Number(params.status)), ctx.json({ error: 'error' }))
  }),
  rest.get('https://local.dev/network-error', (req, res, ctx) => {
    return res.networkError('Failed to connect')
  }),

  rest.post('https://local.dev/post', async (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(await req.json()))
  }),

  rest.get('https://local.dev/redirect', async (req, res, ctx) => {
    return res(
      ctx.status(301),
      ctx.set('Location', 'https://local.dev/redirected')
    )
  }),

  rest.get('https://local.dev/redirected', async (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ hello: 'world' }))
  }),

  rest.get('http://localhost:8999/', (req, res, ctx) => {
    return req.passthrough()
  }),
  rest.get('https://google.com/', (req, res, ctx) => {
    return req.passthrough()
  }),
])
test.before(async () => {
  server.start({ quiet: true })
})

test.after(() => {
  server.stop()
})

test('should request 200', async () => {
  const { error, result } = await request('https://local.dev')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, { hello: 'world' })
  }
})

test('should post json', async () => {
  const { error, result } = await request('https://local.dev/post', {
    method: 'POST',
    body: JSON.stringify({ hello: 'world' }),
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, { hello: 'world' })
  }
})

test('should request 500', async () => {
  const { error } = await request('https://local.dev/error?status=500')

  if (HttpError.is(error)) {
    assert.equal(error.message, 'Internal Server Error')
    assert.equal(error.code, 500)
    assert.equal(error.data, undefined)
  } else {
    assert.fail('should fail')
  }
})

test('should request 501', async () => {
  const { error } = await request('https://local.dev/error?status=501')

  if (HttpError.is(error)) {
    assert.equal(error.message, 'Not Implemented')
    assert.equal(error.code, 501)
    assert.equal(error.data, undefined)
    assert.ok(error.response)
  } else {
    assert.fail('should fail')
  }
})

test('should request 500 with text body', async () => {
  const { error } = await request(
    'https://local.dev/error?status=500&text=hello'
  )

  if (HttpError.is(error)) {
    assert.equal(error.message, 'Internal Server Error: hello')
    assert.equal(error.code, 500)
    assert.equal(error.data, undefined)
    assert.ok(error.response)
  } else {
    assert.fail('should fail')
  }
})

test('should request 500 with json body', async () => {
  const { error } = await request('https://local.dev/error-json?status=500')

  if (HttpError.is(error)) {
    assert.equal(error.message, 'API Error')
    assert.equal(error.code, 500)
    assert.deepEqual(error.data, { error: 'error' })
    assert.equal(error.cause, undefined)
    assert.ok(error.response)
  } else {
    assert.fail('should fail')
  }
})

test('should handle network error', async () => {
  const { error } = await request('https://local.dev/network-error')

  if (error) {
    assert.equal(error.message, 'Failed to fetch')
    assert.equal(error.name, 'NetworkError')
  } else {
    assert.fail('should fail')
  }
})

test('should timeout after 100ms', async () => {
  const { error } = await request('https://google.com', {
    timeout: 100,
  })

  if (error) {
    assert.equal(error.message, 'Request timed out after 100ms')
    assert.ok(error.cause)
    assert.equal(error.name, 'TimeoutError')
  } else {
    assert.fail('should fail')
  }
})

test('should abort manually', async () => {
  const controller = new AbortController()
  const rsp = request('https://google.com', {
    signal: controller.signal,
  })

  controller.abort('reason')
  const { error } = await rsp
  if (error) {
    assert.equal(error.message, 'Request aborted: reason')
    assert.ok(error.cause)
    assert.equal(error.name, 'AbortError')
  } else {
    assert.fail('should fail')
  }
})

test(
  'should retry failed network error',
  async () => {
    const { error } = await request('http://localhost:8999', {
      retry: { retries: 1 },
    })

    if (error) {
      assert.equal(error.message, 'Request failed after 2 attempts')
      assert.ok(error.cause)
      assert.equal(error.name, 'RetryError')
    } else {
      assert.fail('should fail')
    }
  },
  { timeout: 10_000 }
)

test(
  'should retry failed',
  async () => {
    const { error } = await request('https://local.dev/error?status=500', {
      retry: { retries: 1 },
    })

    if (error) {
      assert.equal(error.message, 'Request failed after 2 attempts')
      assert.ok(error.cause)
      assert.equal(error.name, 'RetryError')
    } else {
      assert.fail('should fail')
    }
  },
  { timeout: 10_000 }
)
