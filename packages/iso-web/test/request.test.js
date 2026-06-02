import { delay, HttpResponse, http } from 'msw'
import { assert, suite } from 'playwright-test/taps'
import { z } from 'zod'
import {
  HttpError,
  JsonError,
  RequestError,
  request,
  SchemaError,
} from '../src/http.js'
import { setup } from '../src/msw/msw.js'

const test = suite('request')

const server = setup()

const handlers = [
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
]

test.before(async () => {
  await server.start()
})

test.beforeEach(() => {
  server.resetHandlers()
  server.use(...handlers)
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

test('should post json', async () => {
  server.use(
    http.post('https://local.dev/post', async ({ request }) => {
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
    assert.equal(error.message, '500 - Internal Server Error')
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
    assert.equal(error.message, '501 - Not Implemented')
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
      return HttpResponse.json(
        { error: 'error' },
        { status: Number(params.status) }
      )
    })
  )
  const { error } = await request('https://local.dev/error-json?status=500')

  if (HttpError.is(error)) {
    assert.equal(error.message, '500 - Internal Server Error')
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
  let count = 0
  server.use(
    http.get('https://local.dev/network-error', () => {
      count++
      return Response.error()
    })
  )
  const { error } = await request('https://local.dev/network-error')

  if (error) {
    assert.equal(error.message, 'Network request failed')
    assert.equal(error.name, 'NetworkError')
    assert.equal(count, 1)
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

test('should retry failed network error', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/network-error', () => {
      count++
      return Response.error()
    })
  )
  const { error } = await request('https://local.dev/network-error', {
    retry: {
      retries: 2,
      factor: 1,
      minTimeout: 10,
    },
  })

  if (error) {
    assert.equal(error.message, 'Network request failed')
    assert.equal(count, 3)
  } else {
    assert.fail('should fail')
  }
})

test(
  'should retry with default options when retry is true',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/retry-true', () => {
        count++
        if (count === 1) {
          return Response.error()
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request('https://local.dev/retry-true', {
      retry: true,
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 2)
    }
  },
  { timeout: 10_000 }
)

test('should force retry and failed', async () => {
  let count = 0
  const { error } = await request('https://local.dev/error?status=501', {
    retry: {
      retries: 1,
      factor: 1,
      minTimeout: 10,
      shouldRetry: () => {
        count++
        return true
      },
    },
  })

  if (error) {
    assert.equal(error.message, '501 - Not Implemented')
    assert.equal(count, 1)
  } else {
    assert.fail('should fail')
  }
})

test(
  'should timeout with retries',
  async () => {
    server.use(
      http.get('https://local.dev/network-error', () => {
        return HttpResponse.text('error', { status: 500 })
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

test(
  'should retry on 2xx status codes when specified in statusCodes',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/processing', () => {
        count++
        if (count < 3) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request('https://local.dev/processing', {
      retry: {
        statusCodes: [202],
        retries: 5,
        minTimeout: 10,
        factor: 1,
      },
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
    }
  },
  { timeout: 10_000 }
)

test(
  'should retry POST requests with custom shouldRetry',
  async () => {
    let count = 0
    server.use(
      http.post('https://local.dev/processing', () => {
        count++
        if (count < 3) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request.post(
      'https://local.dev/processing',
      {
        body: JSON.stringify({ hello: 'world' }),
        headers: {
          'Content-Type': 'application/json',
        },
        retry: {
          statusCodes: [202],
          retries: 5,
          minTimeout: 10,
          factor: 1,
          methods: ['post'],
          shouldRetry: (ctx) => {
            return ctx.error.message === 'post-error'
          },
        },
        onResponse: (response) => {
          if (response.status === 202) {
            throw new Error('post-error')
          }
          return response
        },
      }
    )

    if (error) {
      assert.fail(error)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
    }
  },
  { timeout: 10_000 }
)

test(
  'should fail after retries exhausted on 2xx status code',
  async () => {
    server.use(
      http.get('https://local.dev/always-processing', () => {
        return HttpResponse.json({ status: 'processing' }, { status: 202 })
      })
    )

    const { error } = await request('https://local.dev/always-processing', {
      retry: {
        statusCodes: [202],
        retries: 2,
        minTimeout: 10,
        factor: 1,
      },
    })

    if (error) {
      assert.ok(HttpError.is(error))
      assert.equal(error.code, 202)
    } else {
      assert.fail('should fail')
    }
  },
  { timeout: 10_000 }
)

test(
  'should poll on 202 status codes',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/polling', () => {
        count++
        if (count < 3) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request('https://local.dev/polling', {
      poll: {
        interval: 1,
      },
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
    }
  },
  { timeout: 10_000 }
)

test('should not poll by default', async () => {
  let count = 0
  server.use(
    http.get('https://local.dev/polling-default-false', () => {
      count++
      return HttpResponse.json({ status: 'processing' }, { status: 202 })
    })
  )

  const { error, result } = await request(
    'https://local.dev/polling-default-false'
  )

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 202)
    assert.deepEqual(await result.json(), { status: 'processing' })
    assert.equal(count, 1)
  }
})

test(
  'should poll with default options when poll is true',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/polling-true', () => {
        count++
        if (count === 1) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request('https://local.dev/polling-true', {
      poll: true,
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 2)
    }
  },
  { timeout: 10_000 }
)

test(
  'should retry network errors before polling recovered responses',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/retry-then-poll', () => {
        count++
        if (count === 1) {
          return Response.error()
        }
        if (count === 2) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/retry-then-poll',
      {
        retry: {
          retries: 2,
          minTimeout: 1,
          factor: 1,
        },
        poll: {
          interval: 1,
        },
      }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
    }
  },
  { timeout: 10_000 }
)

test(
  'should retry retry-after responses before polling recovered responses',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/retry-after-then-poll', () => {
        count++
        if (count === 1) {
          return HttpResponse.json(
            { error: 'rate limited' },
            { status: 429, headers: { 'retry-after': '0.001' } }
          )
        }
        if (count === 2) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/retry-after-then-poll',
      {
        retry: {
          retries: 2,
          minTimeout: 1,
          factor: 1,
        },
        poll: {
          interval: 1,
        },
      }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'ready' })
      assert.equal(count, 3)
    }
  },
  { timeout: 10_000 }
)

test(
  'should stop polling when shouldPoll returns false',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/polling-stop', () => {
        count++
        return HttpResponse.json(
          { status: 'processing', count },
          { status: 202 }
        )
      })
    )

    const { error, result } = await request('https://local.dev/polling-stop', {
      poll: {
        interval: 1,
        shouldPoll: async (ctx) => {
          assert.equal(ctx.attempt, 0)
          assert.deepEqual(await ctx.response.json(), {
            status: 'processing',
            count: 1,
          })
          return false
        },
      },
    })

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 202)
      assert.deepEqual(await result.json(), {
        status: 'processing',
        count: 1,
      })
      assert.equal(count, 1)
    }
  },
  { timeout: 10_000 }
)

test(
  'should stop polling when shouldPoll returns a response',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/polling-response', () => {
        count++
        return HttpResponse.json({ status: 'processing' }, { status: 202 })
      })
    )

    const { error, result } = await request(
      'https://local.dev/polling-response',
      {
        poll: {
          interval: 1,
          shouldPoll: () => {
            return HttpResponse.json({ data: 'replacement' }, { status: 200 })
          },
        },
      }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.equal(result.status, 200)
      assert.deepEqual(await result.json(), { data: 'replacement' })
      assert.equal(count, 1)
    }
  },
  { timeout: 10_000 }
)

test(
  'should timeout during polling interval',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/polling-timeout', () => {
        count++
        return HttpResponse.json({ status: 'processing' }, { status: 202 })
      })
    )

    const { error } = await request('https://local.dev/polling-timeout', {
      timeout: 20,
      poll: {
        interval: 100,
        limit: 5,
      },
    })

    if (error) {
      assert.equal(error.message, 'Request timed out after 20ms')
      assert.ok(error.cause)
      assert.equal(error.name, 'TimeoutError')
      assert.equal(count, 1)
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
    assert.equal(error.message, '500 - Internal Server Error')
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
    assert.equal(error.message, '500 - Internal Server Error')
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

test(
  'should request json after polling',
  async () => {
    let count = 0
    server.use(
      http.get('https://local.dev/json-polling', () => {
        count++
        if (count < 3) {
          return HttpResponse.json({ status: 'processing' }, { status: 202 })
        }
        return HttpResponse.json({ data: 'ready' }, { status: 200 })
      })
    )

    const { error, result } = await request.json(
      'https://local.dev/json-polling',
      {
        poll: {
          interval: 1,
        },
      }
    )

    if (error) {
      assert.fail(error.message)
    } else {
      assert.deepEqual(result, { data: 'ready' })
      assert.equal(count, 3)
    }
  },
  { timeout: 10_000 }
)

test('should request json with schema', async () => {
  server.use(
    http.get('https://local.dev', () => {
      return HttpResponse.json({ hello: 'world' }, { status: 200 })
    })
  )

  const schema = z.object({ hello: z.literal('world') }).transform((value) => ({
    greeting: value.hello,
  }))

  const { error, result } = await request.json('https://local.dev', { schema })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, { greeting: 'world' })
  }
})

test('should fail request json with schema issues', async () => {
  server.use(
    http.get('https://local.dev', () => {
      return HttpResponse.json({ hello: 'world' }, { status: 200 })
    })
  )

  const schema = z.object({ count: z.number() })

  z.prettifyError

  const { error } = await request.json('https://local.dev', { schema })

  if (SchemaError.is(error)) {
    assert.equal(error.message, 'Schema validation failed')
    assert.equal(
      error.issues[0]?.message,
      'Invalid input: expected number, received undefined'
    )
    assert.equal(error.response.status, 200)
  } else {
    assert.fail('should fail')
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
