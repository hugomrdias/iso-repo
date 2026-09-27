import { assert, suite } from 'playwright-test/taps'
import { request } from '../src/http.js'

const test = suite('http response cloning')
const url = 'https://local.dev/clone'

class CountingResponse extends Response {
  static clones = 0

  /** @returns {Response} */
  clone() {
    CountingResponse.clones++
    return super.clone()
  }
}

test.beforeEach(() => {
  CountingResponse.clones = 0
})

test('should not clone the response without onResponse', async () => {
  const response = new CountingResponse('ok')
  const { error, result } = await request(url, {
    fetch: async () => response,
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(CountingResponse.clones, 0)
    assert.equal(result, response)
    assert.equal(await result.text(), 'ok')
  }
})

test('should not clone error responses without onResponse', async () => {
  const response = new CountingResponse('nope', { status: 500 })
  const { error } = await request(url, { fetch: async () => response })

  assert.equal(error?.name, 'HttpError')
  assert.equal(CountingResponse.clones, 0)
})

test('should stream the body without teeing it', async () => {
  const chunks = 16
  let pulled = 0
  const body = new ReadableStream({
    pull(controller) {
      if (pulled++ >= chunks) {
        controller.close()
      } else {
        controller.enqueue(new Uint8Array(1024).fill(1))
      }
    },
  })
  const { error, result } = await request(url, {
    fetch: async () => new CountingResponse(body),
    timeout: false,
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.ok(result.body === body, 'body stream should not be teed')
    const bytes = await result.arrayBuffer()
    assert.equal(bytes.byteLength, chunks * 1024)
    assert.equal(CountingResponse.clones, 0)
  }
})

test('should clone once for onResponse', async () => {
  /** @type {string[]} */
  const seen = []
  const { error, result } = await request(url, {
    fetch: async () => new CountingResponse('ok'),
    onResponse: async (response) => {
      seen.push(await response.text())
    },
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(CountingResponse.clones, 1)
    assert.deepEqual(seen, ['ok'])
    assert.equal(await result.text(), 'ok')
  }
})

test('should not clone poll responses without poll hooks', async () => {
  let count = 0
  const { error, result } = await request(url, {
    fetch: async () =>
      new CountingResponse('', { status: count++ < 3 ? 202 : 200 }),
    poll: { interval: 1 },
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.equal(count, 4)
    assert.equal(CountingResponse.clones, 0)
  }
})

test('should clone poll responses only for the hooks that are set', async () => {
  let count = 0
  const { error, result } = await request(url, {
    fetch: async () =>
      new CountingResponse(String(count), {
        status: count++ < 3 ? 202 : 200,
      }),
    poll: {
      interval: async (ctx) => {
        await ctx.response.text()
        return 1
      },
      shouldPoll: async (ctx) => {
        await ctx.response.text()
        return ctx.response.status === 202
      },
    },
  })

  if (error) {
    assert.fail(error.message)
  } else {
    assert.equal(result.status, 200)
    assert.equal(await result.text(), '3')
    // 4 shouldPoll calls + 3 interval calls
    assert.equal(CountingResponse.clones, 7)
  }
})
