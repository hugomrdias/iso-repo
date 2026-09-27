import delay from 'delay'
import { KV } from 'iso-kv'
import { http } from 'msw'
import { assert, suite } from 'playwright-test/taps'
import { DohError, HttpError, JsonError, resolve } from '../src/doh/index.js'
import { setup } from '../src/msw/msw.js'

let expireCount = 0
const handlers = [
  http.get('https://cloudflare-dns.com/dns-query', ({ request }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams)
    if (params.name === 'google.com' && params.type === 'A') {
      return Response.json(
        {
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Question: [{ name: 'google.com', type: 1 }],
          Answer: [
            { name: 'google.com', type: 1, TTL: 100, data: '142.250.184.174' },
          ],
        },
        { status: 200 }
      )
    }
    if (params.name === 'expires.com' && params.type === 'A') {
      expireCount++
      return Response.json(
        {
          Status: 0,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Question: [{ name: 'google.com', type: 1 }],
          Answer: [
            {
              name: 'google.com',
              type: 1,
              TTL: 1,
              data: expireCount === 1 ? '142.250.184.174' : `${expireCount}`,
            },
          ],
        },
        { status: 200 }
      )
    }
    if (params.name === 'error.com' && params.type === 'A') {
      return Response.json({
        Status: 2,
        TC: false,
        RD: true,
        RA: true,
        AD: false,
        CD: false,
        Question: [{ name: 'error.com', type: 1 }],
        Comment: 'Invalid domain name',
      })
    }
    if (params.name === 'example..com') {
      return Response.json(
        {
          error: 'Invalid query name `example..com`.',
        },
        { status: 400, statusText: 'Bad Request' }
      )
    }
    if (params.name === 'exampleελ.com') {
      return new Response('malformed', {
        status: 400,
        statusText: 'Bad Request',
      })
    }
  }),
]

const test = suite('doh')
const server = setup()
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

test('should resolve A', async () => {
  const { error, result } = await resolve('google.com', 'A')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, ['142.250.184.174'])
  }
})

test('should resolve from cache', async () => {
  const cache = new KV()
  const url = 'https://cloudflare-dns.com/dns-query?name=google.com&type=A'
  const result = await resolve('google.com', 'A', {
    cache,
  })
  if (result.error) {
    assert.fail(result.error.message)
  } else {
    assert.deepEqual(result, await cache.get([url]))
  }

  // second from cache
  await cache.set([url], { result: [1] }, { ttl: 1 })

  const out1 = await resolve('google.com', 'A', {
    cache,
  })
  assert.deepEqual(out1, { result: [1] })

  // after ttl should resolve again
  await delay(2000)

  const out2 = await resolve('google.com', 'A', {
    cache,
  })
  assert.deepEqual(out2, { result: ['142.250.184.174'] })
})

test('should expire from cache', async () => {
  const out = await resolve('expires.com', 'A')
  assert.deepEqual(out, { result: ['142.250.184.174'] })

  const out1 = await resolve('expires.com', 'A')
  assert.deepEqual(out1, { result: ['142.250.184.174'] })

  // after ttl should resolve again
  await delay(2000)

  const out2 = await resolve('expires.com', 'A')
  assert.deepEqual(out2, { result: ['2'] })
})

test('should fail with status 2 and comment', async () => {
  const { error } = await resolve('error.com', 'A')

  if (error) {
    assert.deepEqual(
      error.message,
      'Server failed to complete the DNS request - Invalid domain name'
    )
    assert.ok(DohError.is(error))
    assert.deepEqual(error.data.Question, [{ name: 'error.com', type: 1 }])
  } else {
    assert.fail('should fail')
  }
})

test('should fail with 400 for invalid domain', async () => {
  const { error } = await resolve('example..com', 'A')

  if (error) {
    assert.ok(JsonError.is(error))
    assert.deepEqual(error.cause, {
      error: 'Invalid query name `example..com`.',
    })
    assert.deepEqual(error.message, 'Failed with a JSON error, see cause.')
  } else {
    assert.fail('should fail')
  }
})

/**
 * Capture DoH requests made to `server` and answer them with a TXT record.
 *
 * @param {string} server
 */
function captureRequests(server) {
  /** @type {URL[]} */
  const urls = []
  const handler = http.get(server, ({ request }) => {
    const url = new URL(request.url)
    urls.push(url)
    return Response.json({
      Status: 0,
      Question: [{ name: url.searchParams.get('name'), type: 16 }],
      Answer: [
        {
          name: url.searchParams.get('name'),
          type: 16,
          TTL: 60,
          data: 'hello',
        },
      ],
    })
  })
  return { urls, handler }
}

test('should encode query name with reserved characters', async () => {
  const { urls, handler } = captureRequests(
    'https://cloudflare-dns.com/dns-query'
  )
  server.use(handler)
  const cache = new KV()

  const out = await resolve('a.com&type=A', 'TXT', { cache })

  assert.deepEqual(out, { result: ['hello'] })
  assert.equal(urls.length, 1)
  assert.deepEqual(urls[0].searchParams.getAll('name'), ['a.com&type=A'])
  assert.deepEqual(urls[0].searchParams.getAll('type'), ['TXT'])
})

test('should not truncate query name at #', async () => {
  const { urls, handler } = captureRequests(
    'https://cloudflare-dns.com/dns-query'
  )
  server.use(handler)
  const cache = new KV()

  const out = await resolve('c.com#frag', 'TXT', { cache })

  assert.deepEqual(out, { result: ['hello'] })
  assert.equal(urls.length, 1)
  assert.deepEqual(urls[0].searchParams.getAll('name'), ['c.com#frag'])
  assert.deepEqual(urls[0].searchParams.getAll('type'), ['TXT'])
})

test('should keep existing query params of the server url', async () => {
  const { urls, handler } = captureRequests('https://dns.example/resolve')
  server.use(handler)
  const cache = new KV()

  const out = await resolve('b.com', 'TXT', {
    cache,
    server: 'https://dns.example/resolve?ct=application/dns-json',
  })

  assert.deepEqual(out, { result: ['hello'] })
  assert.equal(urls.length, 1)
  assert.deepEqual(Object.fromEntries(urls[0].searchParams), {
    ct: 'application/dns-json',
    name: 'b.com',
    type: 'TXT',
  })
})

test('should use the encoded request url as cache key', async () => {
  const { urls, handler } = captureRequests(
    'https://cloudflare-dns.com/dns-query'
  )
  server.use(handler)
  const cache = new KV()

  await resolve('a.com&type=A', 'TXT', { cache })
  await resolve('a.com', 'A', { cache })
  await resolve('a.com&type=A', 'TXT', { cache })

  assert.equal(urls.length, 2)
  assert.ok(
    await cache.get([
      'https://cloudflare-dns.com/dns-query?name=a.com%26type%3DA&type=TXT',
    ])
  )
  assert.ok(
    await cache.get(['https://cloudflare-dns.com/dns-query?name=a.com&type=A'])
  )
})

test('should fail with non-ascii chars', async () => {
  const { error } = await resolve('exampleελ.com', 'A')
  if (error) {
    assert.ok(HttpError.is(error))
    assert.deepEqual(await error.response.text(), 'malformed')
    assert.deepEqual(error.message, '400 - Bad Request')
  } else {
    assert.fail('should fail')
  }
})
