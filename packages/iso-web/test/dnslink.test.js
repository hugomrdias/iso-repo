import { assert, suite } from 'playwright-test/taps'
import { rest } from 'msw'
import { DohError, NetworkError, resolve } from '../src/doh/dnslink.js'
import { setup } from '../src/msw/msw.js'

/**
 *
 * @param {string[]} values
 * @param {number} [status]
 * @returns
 */
function mockRecord(values, status = 0) {
  return {
    Status: status,
    TC: false,
    RD: true,
    RA: true,
    AD: false,
    CD: false,
    Question: [{ name: '_dnslink.ipfs.io', type: 16 }],
    Answer: values.map((data) => ({
      name: '_dnslink.ipfs.io',
      type: 16,
      TTL: 60,
      data,
    })),
  }
}

export const handlers = [
  rest.get('https://cloudflare-dns.com/dns-query', (req, res, ctx) => {
    const params = Object.fromEntries(req.url.searchParams)

    if (params.name === '_dnslink.docs.ipfs.tech') {
      return res(
        ctx.status(200),
        ctx.json(
          mockRecord([
            '_dnslink.ipfs-docs.on.fleek.co.',
            'dnslink=/ipfs/Qdocsipfstech',
          ])
        )
      )
    }

    if (params.name === '_dnslink.ipfs.io') {
      return res(
        ctx.status(200),
        ctx.json(mockRecord(['"dnslink=/ipns/ipns/path/here"']))
      )
    }

    if (
      params.name === '_dnslink.maindomainerror.io' &&
      params.type === 'TXT'
    ) {
      return res.networkError('Failed to connect')
    }

    if (params.name === 'maindomainerror.io') {
      return res(
        ctx.status(200),
        ctx.json(mockRecord(['"dnslink=/ipns/ipns/path/here"']))
      )
    }

    if (params.name === '_dnslink.empty.io') {
      return res(ctx.status(200), ctx.json(mockRecord([])))
    }

    if (params.name === 'empty.io') {
      return res(
        ctx.status(200),
        ctx.json(mockRecord(['"dnslink=/ipns/ipns/path/here"']))
      )
    }

    if (
      params.name === '_dnslink.no-records.io' ||
      params.name === 'no-records.io'
    ) {
      return res(ctx.status(200), ctx.json(mockRecord([])))
    }
    if (
      params.name === '_dnslink.no-slash.io' ||
      params.name === 'no-slash.io'
    ) {
      return res(
        ctx.status(200),
        ctx.json(mockRecord(['"dnslink="', 'dnslink= /ipfs/ dddd']))
      )
    }

    if (params.name === '_dnslink.invalid.io' || params.name === 'invalid.io') {
      return res(
        ctx.status(200),
        ctx.json(
          mockRecord([
            'dnslink=/\u0019',
            'dnslink=/\u007F',
            'dnslink=/フゲ/UVWX',
            'dnslink=/YZ12/ホガ',
            'dnslink=/',
            'dnslink=/ipfs/',
            'dnslink=/testnamespace',
            'dnslink=/testnamespace/',
            'dnslink=/testnamespace%',
            'dnslink= //\u0019',
            'dnslink=//\u0019',
            'dnslink=//',
            'dnslink=/testnamespace/',
            'dnslink=/testnamespace/Z123 ',
            'dnslink=/testnamespace/QRST',
            'dnslink=/testnamespace/ UVWX',
            'dnslink=/testnamespace/lowercase',
          ])
        )
      )
    }

    if (params.name === '_dnslink.valid.io' || params.name === 'valid.io') {
      return res(
        ctx.status(200),
        ctx.json(
          mockRecord([
            'dnslink=/ns_1/4567',
            'dnslink=/ns_1/890A',
            'dnslink=/ns_3/AABC',
            'dnslink=/ns_2/AADE',
            'dnslink=/testnamespace/ ',
            'dnslink=/ /AAFG',
            'dnslink=/testnamespace / AAHI ',
            'dnslink=/ testnamespace/AAJK/LM',
            'dnslink=/testnamespace/AANO/PQ?RS=TU',
            'dnslink=/testnamespace/AAVW/ XY/ ?Z1=23 ',
            'dnslink=/%E3%81%B5%E3%81%92/AA45',
            'dnslink=/testnamespace/%E3%83%9B%E3%82%AC',
            'dnslink=/testnamespace%/AA67%',
            'dnslink=/dnslink/AA89',
          ])
        )
      )
    }
    if (
      params.name === '_dnslink.doh-error.io' ||
      params.name === 'doh-error.io'
    ) {
      return res(ctx.status(200), ctx.json(mockRecord([], 2)))
    }

    if (
      params.name === '_dnslink.fetch-error.io' ||
      params.name === 'fetch-error.io'
    ) {
      return res.networkError('Failed to connect')
    }
  }),
]

const test = suite('dnslink')
const server = setup(handlers)
test.before(async () => {
  server.start({ quiet: true })
})

test.after(() => {
  server.stop()
})

test('should resolve ipfs path on _dnslink', async () => {
  const { error, result } = await resolve('docs.ipfs.tech')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, ['/ipfs/Qdocsipfstech'])
  }
})

test('should resolve ipns path on _dnslink', async () => {
  const { error, result } = await resolve('ipfs.io')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, ['/ipns/ipns/path/here'])
  }
})

test('should resolve on main domain as fallback of an error', async () => {
  const { error, result } = await resolve('maindomainerror.io')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, ['/ipns/ipns/path/here'])
  }
})

test('should resolve on main domain as fallback of empty records', async () => {
  const { error, result } = await resolve('empty.io')

  if (error) {
    assert.fail(error.message)
  } else {
    assert.deepEqual(result, [])
  }
})

test('should return empty array for no records', async () => {
  const { result } = await resolve('no-records.io')

  assert.deepEqual(result, [])
})

test('should return empty with records without start /', async () => {
  const { result } = await resolve('no-slash.io')

  assert.deepEqual(result, [])
})

test('should ignore invalid and sort valid', async () => {
  const { result } = await resolve('invalid.io')

  assert.deepEqual(result, [
    '/testnamespace/ UVWX',
    '/testnamespace/QRST',
    '/testnamespace/Z123 ',
    '/testnamespace/lowercase',
  ])
})

test('should return valid', async () => {
  const { result } = await resolve('valid.io')

  assert.deepEqual(result, [
    '/ /AAFG',
    '/ testnamespace/AAJK/LM',
    '/%E3%81%B5%E3%81%92/AA45',
    '/dnslink/AA89',
    '/ns_1/4567',
    '/ns_1/890A',
    '/ns_2/AADE',
    '/ns_3/AABC',
    '/testnamespace / AAHI ',
    '/testnamespace%/AA67%',
    '/testnamespace/ ',
    '/testnamespace/%E3%83%9B%E3%82%AC',
    '/testnamespace/AANO/PQ?RS=TU',
    '/testnamespace/AAVW/ XY/ ?Z1=23 ',
  ])
})

test('should return doh error', async () => {
  const { error } = await resolve('doh-error.io')

  assert.ok(DohError.is(error))
  assert.deepEqual(error.message, 'Server failed to complete the DNS request')
})

test('should return fetch error', async () => {
  const { error } = await resolve('fetch-error.io')

  assert.ok(NetworkError.is(error))
  assert.deepEqual(error.message, 'Failed to fetch')
})
