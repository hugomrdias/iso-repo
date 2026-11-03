/** biome-ignore-all lint/suspicious/useAwait: Mock resolvers implement an asynchronous callback API. */
import assert from 'assert'
import { DIDCore } from '../src/core.js'
import { parseDIDURL } from '../src/did-url.js'
import { Resolver, resolve } from '../src/index.js'

/**
 * @param {string} [id]
 * @returns {import('../src/types.js').DIDResolutionResult}
 */
function result(id = 'did:example:123') {
  return {
    didDocument: { id },
    didResolutionMetadata: { contentType: 'application/did+json' },
    didDocumentMetadata: {},
  }
}

describe('DID URL parsing', () => {
  it('preserves encoded identifiers, parameters, paths, queries and fragments', () => {
    const didUrl = 'did:example:a::b%3Ac;x=1;x=2;empty=/path?query=%23#key?x'
    assert.deepEqual(parseDIDURL(didUrl), {
      did: 'did:example:a::b%3Ac',
      didUrl,
      method: 'example',
      id: 'a::b%3Ac',
      params: { x: '2', empty: '' },
      path: '/path',
      query: 'query=%23',
      fragment: 'key?x',
    })
    const core = DIDCore.fromString(didUrl)
    assert.equal(core.toString(), didUrl)
    assert.equal(core.did, 'did:example:a::b%3Ac')
    assert.equal('params' in core, false)
  })

  it('distinguishes absent query and fragment components from empty ones', () => {
    assert.equal(parseDIDURL('did:example:123')?.query, undefined)
    assert.equal(parseDIDURL('did:example:123')?.fragment, undefined)
    assert.equal(parseDIDURL('did:example:123?#')?.query, '')
    assert.equal(parseDIDURL('did:example:123?#')?.fragment, '')
  })

  for (const did of [
    '',
    'did:example:',
    'did:Example:123',
    'DID:example:123',
    'did:example:abc:',
    'did:example:%',
    'did:example:%GG',
    'did:example:abc!',
    'did:example:abc;flag',
    'https://example.com',
  ]) {
    it(`rejects invalid DID ${JSON.stringify(did)}`, () => {
      assert.equal(parseDIDURL(did), null)
      assert.throws(() => DIDCore.fromString(did), TypeError)
    })
  }
})

describe('DID resolver', () => {
  it('forwards the base DID, full parsed URL, resolver and options to a method', async () => {
    const options = { accept: 'application/did+json', versionId: '1' }
    const didUrl = 'did:example:123;service=agent/path?version=1#key'
    const output = result()
    const resolver = new Resolver({
      example: async (did, parsed, dispatcher, forwarded) => {
        assert.equal(did, 'did:example:123')
        assert.deepEqual(parsed, parseDIDURL(didUrl))
        assert.equal(dispatcher, resolver)
        assert.equal(forwarded, options)
        return output
      },
    })
    assert.equal(await resolver.resolve(didUrl, options), output)
  })

  it('returns resolution errors for invalid and unsupported DIDs', async () => {
    const resolver = new Resolver()
    for (const [did, error] of [
      ['invalid', 'invalidDid'],
      ['did:unknown:123', 'unsupportedDidMethod'],
      ['did:constructor:123', 'unsupportedDidMethod'],
      ['did:tostring:123', 'unsupportedDidMethod'],
    ]) {
      assert.deepEqual(await resolver.resolve(did), {
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: { error },
      })
    }
  })

  for (const cache of [undefined, false, true]) {
    it(`supports cache=${cache}`, async () => {
      let calls = 0
      const resolver = new Resolver(
        {
          example: async () => {
            calls++
            return result()
          },
        },
        { cache }
      )
      await resolver.resolve('did:example:123')
      await resolver.resolve('did:example:123')
      assert.equal(calls, cache ? 1 : 2)
    })
  }

  it('keeps full DID URLs as separate cache entries and honors no-cache', async () => {
    let calls = 0
    const resolver = new Resolver(
      {
        example: async () => {
          calls++
          return result()
        },
      },
      { cache: true }
    )
    const cached = await resolver.resolve('did:example:123')
    assert.equal(await resolver.resolve('did:example:123'), cached)
    await resolver.resolve('did:example:123#key')
    await resolver.resolve('did:example:123#key')
    await resolver.resolve('did:example:123;no-cache=true')
    await resolver.resolve('did:example:123;no-cache=true')
    assert.equal(await resolver.resolve('did:example:123'), cached)
    assert.equal(calls, 4)
  })

  for (const error of ['notFound', 'temporarilyUnavailable']) {
    it(`retries ${error} results and then caches successful resolutions`, async () => {
      let calls = 0
      const resolver = new Resolver(
        {
          example: async () => {
            calls++
            if (calls === 1) {
              return {
                ...result(),
                didDocument: null,
                didResolutionMetadata: { error },
              }
            }
            return result()
          },
        },
        { cache: true }
      )
      assert.equal(
        (await resolver.resolve('did:example:123')).didDocument,
        null
      )
      assert.ok((await resolver.resolve('did:example:123')).didDocument)
      await resolver.resolve('did:example:123')
      assert.equal(calls, 2)
    })
  }

  it('propagates method errors and does not cache rejected resolutions', async () => {
    let calls = 0
    const error = new Error('connection failed')
    const resolver = new Resolver(
      {
        example: async () => {
          calls++
          if (calls === 1) throw error
          return result()
        },
      },
      { cache: true }
    )
    await assert.rejects(resolver.resolve('did:example:123'), error)
    assert.ok((await resolver.resolve('did:example:123')).didDocument)
    assert.equal(calls, 2)
  })

  it('lets method resolvers delegate to another registered method', async () => {
    const resolver = new Resolver({
      alias: async (_did, _parsed, dispatcher, options) =>
        dispatcher.resolve('did:example:123', options),
      example: async () => result(),
    })
    assert.deepEqual(await resolver.resolve('did:alias:123'), result())
  })

  it('rejects empty resolution results without caching them', async () => {
    let calls = 0
    const resolver = new Resolver(
      {
        example: async () => {
          calls++
          return { ...result(), didDocument: null }
        },
      },
      { cache: true }
    )
    await assert.rejects(
      resolve('did:example:123', resolver),
      /No DID Document found/
    )
    await assert.rejects(
      resolve('did:example:123', resolver),
      /No DID Document found/
    )
    assert.equal(calls, 2)
  })

  it('accepts external resolver objects through the public resolve helper', async () => {
    const document = result().didDocument
    assert.deepEqual(
      await resolve('did:example:123#key', {
        resolve: async (did, options) => {
          assert.equal(did, 'did:example:123')
          assert.equal(
            options?.accept,
            'application/did+ld+json,application/json'
          )
          return result()
        },
      }),
      document
    )
  })
})
