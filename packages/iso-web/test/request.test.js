import { assert, suite } from 'playwright-test/taps'
import { HttpResponse, delay, http } from 'msw'
import { HttpError, request } from '../src/http.js'
import { setup } from '../src/msw/msw.js'

const test = suite('request')
const server = setup([
  http.get('https://local.dev/error', ({ request }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    return HttpResponse.text(params.text, { status: Number(params.status) })
  }),
  http.get('https://local.dev/timeout', async () => {
    await delay(100)
    return Response.error()
  }),
])

test.before(async () => {
  await server.start({ quiet: true })
})

test.beforeEach(() => {
  server.resetHandlers()
})

test.after(() => {
  server.stop()
})

test('should request 200', async () => {
  server.use(
    http.get('https://local.dev', () => {
      return HttpResponse.json({ hello: 'world' }, { status: 200 })
    })
  )
  const { error, result } = await request('https://local.dev')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, { hello: 'world' })
  }
})

test('should post json', async () => {
  server.use(
    http.post('https://local.dev/post', async ({ request }) => {
      // @ts-ignore
      return Response.json(await request.json(), { status: 200 })
    })
  )
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
    assert.equal(error.message, 'Internal Server Error - hello')
    assert.equal(error.code, 500)
    assert.equal(error.data, undefined)
    assert.ok(error.response)
  } else {
    assert.fail('should fail')
  }
})

test('should request 500 with json body', async () => {
  server.use(
    http.get('https://local.dev/error-json', ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams)
      // @ts-ignore
      return HttpResponse.json(
        { error: 'error' },
        { status: Number(params.status) }
      )
    })
  )
  const { error } = await request('https://local.dev/error-json?status=500')

  if (HttpError.is(error)) {
    assert.equal(
      error.message,
      'Internal Server Error - More details in "error.data"'
    )
    assert.equal(error.code, 500)
    assert.deepEqual(error.data, { error: 'error' })
    assert.equal(error.cause, undefined)
    assert.ok(error.response)
  } else {
    assert.fail('should fail')
  }
})

test('should handle network error', async () => {
  server.use(
    http.get('https://local.dev/network-error', () => {
      return Response.error()
    })
  )
  const { error } = await request('https://local.dev/network-error')

  if (error) {
    assert.equal(error.message, 'Failed to fetch')
    assert.equal(error.name, 'NetworkError')
  } else {
    assert.fail('should fail')
  }
})

test('should timeout after 100ms', async () => {
  const { error } = await request('https://local.dev/timeout', {
    timeout: 10,
  })

  if (error) {
    assert.equal(error.message, 'Request timed out after 10ms')
    assert.ok(error.cause)
    assert.equal(error.name, 'TimeoutError')
  } else {
    assert.fail('should fail')
  }
})

test('should abort manually', async () => {
  const controller = new AbortController()
  const rsp = request('https://local.dev/timeout', {
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
    server.use(
      http.get('https://local.dev/network-error', () => {
        return Response.error()
      })
    )
    const { error } = await request('https://local.dev/network-error', {
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
