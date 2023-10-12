import { assert, suite } from 'playwright-test/taps'
import { KV } from 'iso-kv'
import delay from 'delay'
import { rest } from 'msw'
import { DohError, resolve } from '../src/doh/index.js'
import { setup } from '../src/msw/msw.js'
import { HttpError } from '../src/http.js'

let expireCount = 0
export const handlers = [
  rest.get('https://cloudflare-dns.com/dns-query', (req, res, ctx) => {
    const params = Object.fromEntries(req.url.searchParams)

    if (params.name === 'google.com' && params.type === 'A') {
      return res(
        ctx.status(200),
        ctx.json({
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
        })
      )
    }

    if (params.name === 'expires.com' && params.type === 'A') {
      expireCount++
      return res(
        ctx.status(200),
        ctx.json({
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
        })
      )
    }

    if (params.name === 'error.com' && params.type === 'A') {
      return res(
        ctx.status(200),
        ctx.json({
          Status: 2,
          TC: false,
          RD: true,
          RA: true,
          AD: false,
          CD: false,
          Question: [{ name: 'error.com', type: 1 }],
          Comment: 'Invalid domain name',
        })
      )
    }

    if (params.name === 'example..com') {
      return res(
        ctx.status(400),
        ctx.json({
          error: 'Invalid query name `example..com`.',
        })
      )
    }

    if (params.name === 'exampleελ.com') {
      return res(ctx.status(400), ctx.text('malformed'))
    }
  }),
]

const test = suite('doh')
const server = setup(handlers)
test.before(async () => {
  server.start({ quiet: true })
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
  const url = `https://cloudflare-dns.com/dns-query?name=google.com&type=A`
  const result = await resolve('google.com', 'A', {
    cache,
  })
  if (result.error) {
    assert.fail(result.error.message)
  } else {
    assert.deepEqual(result, await cache.get([url]))
  }

  // second from cache
  await cache.set([url], { result: [1] }, 1)

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
    assert.deepEqual(
      error.message,
      'Bad Request - More details in "error.data"'
    )
    assert.ok(HttpError.is(error))
    assert.deepEqual(error.data, {
      error: 'Invalid query name `example..com`.',
    })
  } else {
    assert.fail('should fail')
  }
})

test('should fail with non-ascii chars', async () => {
  const { error } = await resolve('exampleελ.com', 'A')
  if (error) {
    assert.deepEqual(error.message, 'Bad Request - malformed')
    assert.ok(HttpError.is(error))
  } else {
    assert.fail('should fail')
  }
})
