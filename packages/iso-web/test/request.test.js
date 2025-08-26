import { delay, HttpResponse, http } from 'msw'
import { assert, suite } from 'playwright-test/taps'
import { HttpError, JsonError, RequestError, request } from '../src/http.js'
import { setup } from '../src/msw/msw.js'

const test = suite('request')

const server = setup([
  http.get('https://local.dev/error', ({ request }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    return HttpResponse.text(params.text, { status: Number(params.status) })
  }),
  http.post('https://local.dev/error', ({ request }) => {
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
    assert.deepEqual(await result.json(), { hello: 'world' })
  }
})

test('should request 200 with URL object ', async () => {
  server.use(
    http.get('https://local.dev/url', () => {
      return HttpResponse.json({ hello: 'world' }, { status: 200 })
    })
  )
  const { error, result } = await request(new URL('/url', 'https://local.dev'))

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(await result.json(), { hello: 'world' })
  }
})

test('should retry with on response hook', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/poll', () => {
      return HttpResponse.json(
        { hello: 'world', count: count++ },
        { status: 200 }
      )
    })
  )
  const { error, result } = await request(
    new URL('/poll', 'https://local.dev'),
    {
      retry: {
        factor: 1,
        minTimeout: 1000,
        retries: 3,
      },
      onResponse: async (response) => {
        const data = await response.json()
        if (data.count < 3) {
          return Response.error()
        }
      },
    }
  )

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(await result.json(), { hello: 'world', count: 3 })
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
    assert.deepEqual(await result.json(), { hello: 'world' })
  }
})

test('should request 500', async () => {
  const { error } = await request('https://local.dev/error?status=500')

  if (HttpError.is(error)) {
    assert.equal(error.message, 'HttpError: 500 - Internal Server Error')
    assert.equal(error.code, 500)
  } else {
    assert.fail('should fail')
  }
})

test('should fail with bad resource', async () => {
  // @ts-expect-error - tests bad resource
  const { error } = await request(1000)

  if (RequestError.is(error)) {
    assert.equal(error.message, '`resource` must be a string or URL object')
  } else {
    assert.fail('should fail')
  }
})

test('should request 501', async () => {
  const { error } = await request('https://local.dev/error?status=501')

  if (HttpError.is(error)) {
    assert.equal(error.message, 'HttpError: 501 - Not Implemented')
    assert.equal(error.code, 501)
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
    assert.equal(error.message, 'HttpError: 500 - Internal Server Error')
    assert.equal(error.code, 500)
    assert.equal(error.cause, undefined)
    assert.ok(error.response)

    const errorData = await error.response.json()

    assert.deepEqual(errorData, { error: 'error' })
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
      retry: {
        retries: 1,
      },
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

test(
  'should timeout with retries',
  async () => {
    server.use(
      http.get('https://local.dev/network-error', () => {
        return Response.error()
      })
    )
    const { error } = await request('https://local.dev/network-error', {
      timeout: 100,
      retry: {
        retries: 5,
      },
    })

    if (error) {
      assert.equal(error.message, 'Request timed out after 100ms')
      assert.ok(error.cause)
      assert.equal(error.name, 'TimeoutError')
    } else {
      assert.fail('should fail')
    }
  },
  { timeout: 10_000 }
)

test('should abort manually with retries', async () => {
  const controller = new AbortController()
  const rsp = request('https://local.dev/timeout', {
    retry: {
      retries: 5,
    },
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
  'should delay with retry after header',
  async () => {
    server.use(
      http.get('https://local.dev/retry-after', () => {
        return HttpResponse.json(
          { error: 'error' },
          { status: 429, headers: { 'retry-after': '5' } }
        )
      })
    )
    const { error } = await request('https://local.dev/retry-after', {
      retry: {
        factor: 0,
        retries: 5,
      },
    })

    if (error) {
      assert.equal(error.message, 'Request timed out after 5000ms')
      assert.ok(error.cause)
      assert.equal(error.name, 'TimeoutError')
    } else {
      assert.fail('should fail')
    }
  },
  { timeout: 10_000 }
)

test('should set content-type json', async () => {
  const { error } = await request('https://local.dev/error?status=500', {
    method: 'POST',
    json: { hello: 'world' },
  })

  if (HttpError.is(error)) {
    assert.equal(error.message, 'HttpError: 500 - Internal Server Error')
    assert.equal(error.code, 500)
    assert.equal(error.request.headers.get('content-type'), 'application/json')
  } else {
    assert.fail('should fail')
  }
})

test('should be able to overide with custom json content-type ', async () => {
  const { error } = await request('https://local.dev/error?status=500', {
    method: 'POST',
    json: { hello: 'world' },
    headers: {
      'Content-Type': 'application/custom+json',
    },
  })

  if (HttpError.is(error)) {
    assert.equal(error.message, 'HttpError: 500 - Internal Server Error')
    assert.equal(error.code, 500)
    assert.equal(
      error.request.headers.get('content-type'),
      'application/custom+json'
    )
  } else {
    assert.fail('should fail')
  }
})

test('should request json', async () => {
  server.use(
    http.get('https://local.dev', () => {
      return HttpResponse.json({ hello: 'world' }, { status: 200 })
    })
  )
  const { error, result } = await request.json('https://local.dev')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, { hello: 'world' })
  }
})

test('should request json and error', async () => {
  server.use(
    http.get('https://local.dev', () => {
      return HttpResponse.json({ hello: 'world' }, { status: 500 })
    })
  )

  const { error } = await request.json('https://local.dev')

  assert.ok(JsonError.is(error))
  assert.deepEqual(error.cause, { hello: 'world' })
})
