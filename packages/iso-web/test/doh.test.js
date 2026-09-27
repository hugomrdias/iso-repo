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

/**
 * KV that records the ttl of every `set` call.
 */
function spyCache() {
  const cache = new KV()
  /** @type {Array<{ key: unknown[], value: unknown, ttl?: number | null }>} */
  const sets = []
  const set = cache.set.bind(cache)
  cache.set = (key, value, options) => {
    sets.push({ key, value, ttl: options?.ttl })
    return set(key, value, options)
  }
  return { cache, sets }
}

/**
 * Answer every DoH request to cloudflare with `response`.
 *
 * @param {Record<string, unknown>} response
 */
function respondWith(response) {
  server.use(
    http.get('https://cloudflare-dns.com/dns-query', () =>
      Response.json({ Status: 0, ...response })
    )
  )
}

test('should not return CNAME records for an A query', async () => {
  respondWith({
    Question: [{ name: 'www.alias.com', type: 1 }],
    Answer: [
      { name: 'www.alias.com', type: 5, TTL: 300, data: 'target.cdn.net.' },
      { name: 'target.cdn.net', type: 1, TTL: 300, data: '93.184.216.34' },
    ],
  })

  const out = await resolve('www.alias.com', 'A', { cache: new KV() })

  assert.deepEqual(out, { result: ['93.184.216.34'] })
})

test('should not return CNAME or DNAME records for a TXT query', async () => {
  respondWith({
    Question: [{ name: '_dnslink.docs.alias.com', type: 16 }],
    Answer: [
      { name: 'alias.com', type: 39, TTL: 300, data: 'other.com.' },
      {
        name: '_dnslink.docs.alias.com',
        type: 5,
        TTL: 300,
        data: '_dnslink.docs.other.com.',
      },
      {
        name: '_dnslink.docs.other.com',
        type: 16,
        TTL: 300,
        data: 'dnslink=/ipfs/abc',
      },
    ],
  })

  const out = await resolve('_dnslink.docs.alias.com', 'TXT', {
    cache: new KV(),
  })

  assert.deepEqual(out, { result: ['dnslink=/ipfs/abc'] })
})

test('should return CNAME records for a CNAME query', async () => {
  respondWith({
    Question: [{ name: 'www.alias.com', type: 5 }],
    Answer: [
      { name: 'www.alias.com', type: 5, TTL: 300, data: 'target.cdn.net.' },
    ],
  })

  const out = await resolve('www.alias.com', 'CNAME', { cache: new KV() })

  assert.deepEqual(out, { result: ['target.cdn.net.'] })
})

test('should cache with the minimum ttl of the whole CNAME chain', async () => {
  respondWith({
    Question: [{ name: 'www.alias.com', type: 28 }],
    Answer: [
      { name: 'www.alias.com', type: 5, TTL: 30, data: 'target.cdn.net.' },
      { name: 'target.cdn.net', type: 28, TTL: 300, data: '2001:db8::1' },
    ],
  })
  const { cache, sets } = spyCache()

  const out = await resolve('www.alias.com', 'AAAA', { cache })

  assert.deepEqual(out, { result: ['2001:db8::1'] })
  assert.equal(sets.length, 1)
  assert.equal(sets[0].ttl, 30)
})

test('should fall back to the Question type for unknown record types', async () => {
  respondWith({
    Question: [{ name: 'svc.alias.com', type: 65 }],
    Answer: [
      { name: 'svc.alias.com', type: 5, TTL: 300, data: 'svc.other.com.' },
      { name: 'svc.other.com', type: 65, TTL: 300, data: '1 . alpn=h2' },
    ],
  })

  const out = await resolve(
    'svc.alias.com',
    /** @type {import('../src/doh/types.js').RecordType} */ (
      /** @type {unknown} */ ('HTTPS')
    ),
    { cache: new KV() }
  )

  assert.deepEqual(out, { result: ['1 . alpn=h2'] })
})

/**
 * @param {number} ttl
 * @param {number} minimum
 */
function soa(ttl, minimum) {
  return {
    name: 'nodata.com',
    type: 6,
    TTL: ttl,
    data: `ns1.nodata.com. admin.nodata.com. 2024010101 7200 3600 1209600 ${minimum}`,
  }
}

test('should return empty result for NODATA instead of the SOA record', async () => {
  respondWith({
    Question: [{ name: 'nodata.com', type: 16 }],
    Authority: [soa(900, 300)],
  })
  const { cache, sets } = spyCache()

  const out = await resolve('nodata.com', 'TXT', { cache })

  assert.deepEqual(out, { result: [] })
  assert.equal(sets.length, 1)
  assert.equal(sets[0].ttl, 300)
})

test('should cache NODATA with the SOA ttl when lower than MINIMUM', async () => {
  respondWith({
    Question: [{ name: 'nodata.com', type: 1 }],
    Authority: [soa(60, 300)],
  })
  const { cache, sets } = spyCache()

  const out = await resolve('nodata.com', 'A', { cache })

  assert.deepEqual(out, { result: [] })
  assert.equal(sets[0].ttl, 60)
})

test('should cap the negative cache ttl', async () => {
  respondWith({
    Question: [{ name: 'nodata.com', type: 1 }],
    Authority: [soa(86_400, 86_400)],
  })
  const { cache, sets } = spyCache()

  await resolve('nodata.com', 'A', { cache })

  assert.equal(sets[0].ttl, 3600)
})

test('should return empty result for NODATA on SOA queries', async () => {
  respondWith({
    Question: [{ name: 'www.nodata.com', type: 6 }],
    Authority: [soa(900, 300)],
  })

  const out = await resolve('www.nodata.com', 'SOA', { cache: new KV() })

  assert.deepEqual(out, { result: [] })
})

test('should return SOA records from Answer for SOA queries', async () => {
  const record = soa(900, 300)
  respondWith({
    Question: [{ name: 'nodata.com', type: 6 }],
    Answer: [record],
  })

  const out = await resolve('nodata.com', 'SOA', { cache: new KV() })

  assert.deepEqual(out, { result: [record.data] })
})

test('should return empty result without Answer or Authority', async () => {
  respondWith({ Question: [{ name: 'nodata.com', type: 16 }] })
  const { cache, sets } = spyCache()

  const out = await resolve('nodata.com', 'TXT', { cache })

  assert.deepEqual(out, { result: [] })
  assert.equal(sets[0].ttl, 300)
})

test('should not cache an empty Answer forever', async () => {
  respondWith({ Question: [{ name: 'empty.com', type: 16 }], Answer: [] })
  const { cache, sets } = spyCache()

  const out = await resolve('empty.com', 'TXT', { cache })

  assert.deepEqual(out, { result: [] })
  assert.equal(sets.length, 1)
  assert.equal(sets[0].ttl, 300)
})

test('should cache a CNAME chain without target records as NODATA', async () => {
  respondWith({
    Question: [{ name: 'www.alias.com', type: 16 }],
    Answer: [
      { name: 'www.alias.com', type: 5, TTL: 900, data: 'target.cdn.net.' },
    ],
    Authority: [soa(900, 120)],
  })
  const { cache, sets } = spyCache()

  const out = await resolve('www.alias.com', 'TXT', { cache })

  assert.deepEqual(out, { result: [] })
  assert.equal(sets[0].ttl, 120)
})

/**
 * Answer the first request with `status` and every other one with an A record.
 *
 * @param {number} status
 */
function failOnce(status) {
  let calls = 0
  server.use(
    http.get('https://cloudflare-dns.com/dns-query', () => {
      calls++
      if (calls === 1) {
        return Response.json({
          Status: status,
          Question: [{ name: 'flaky.com', type: 1 }],
        })
      }
      return Response.json({
        Status: 0,
        Question: [{ name: 'flaky.com', type: 1 }],
        Answer: [{ name: 'flaky.com', type: 1, TTL: 300, data: '1.2.3.4' }],
      })
    })
  )
  return {
    get calls() {
      return calls
    },
  }
}

test('should not cache SERVFAIL', async () => {
  const upstream = failOnce(2)
  const cache = new KV()

  const first = await resolve('flaky.com', 'A', { cache })
  assert.ok(DohError.is(first.error))
  assert.equal(
    first.error?.message,
    'Server failed to complete the DNS request'
  )

  const second = await resolve('flaky.com', 'A', { cache })
  assert.deepEqual(second, { result: ['1.2.3.4'] })
  assert.equal(upstream.calls, 2)
})

test('should not cache REFUSED', async () => {
  const upstream = failOnce(5)
  const cache = new KV()

  const first = await resolve('flaky.com', 'A', { cache })
  assert.ok(DohError.is(first.error))

  const second = await resolve('flaky.com', 'A', { cache })
  assert.deepEqual(second, { result: ['1.2.3.4'] })
  assert.equal(upstream.calls, 2)
})

test('should cache NXDOMAIN with the SOA negative ttl', async () => {
  respondWith({
    Status: 3,
    Question: [{ name: 'nxdomain.com', type: 1 }],
    Authority: [soa(900, 1800)],
  })
  const { cache, sets } = spyCache()

  const out = await resolve('nxdomain.com', 'A', { cache })

  assert.ok(DohError.is(out.error))
  assert.equal(out.error?.message, 'Domain name does not exist')
  assert.equal(sets.length, 1)
  assert.equal(sets[0].ttl, 900)
})

test('should cache NXDOMAIN without SOA with the fallback ttl', async () => {
  respondWith({ Status: 3, Question: [{ name: 'nxdomain.com', type: 1 }] })
  const { cache, sets } = spyCache()

  await resolve('nxdomain.com', 'A', { cache })

  assert.equal(sets[0].ttl, 300)
})

test('should cache deterministic errors for an hour', async () => {
  respondWith({ Status: 1, Question: [{ name: 'formerr.com', type: 1 }] })
  const { cache, sets } = spyCache()

  const out = await resolve('formerr.com', 'A', { cache })

  assert.ok(DohError.is(out.error))
  assert.equal(sets[0].ttl, 3600)
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
