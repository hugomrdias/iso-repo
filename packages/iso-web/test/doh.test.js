import { assert, suite } from 'playwright-test/taps'
import { KV } from 'iso-kv'
import delay from 'delay'
import { resolve } from '../src/doh/index.js'
import { setup } from '../src/msw/msw.js'
import { handlers } from './mocks/handlers.js'

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
