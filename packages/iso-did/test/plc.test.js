import assert from 'assert'
import { parse, Resolver, resolve } from '../src/index.js'
import { createPlcResolver } from '../src/plc.js'

const resolver = new Resolver({
  plc: createPlcResolver(),
})

describe('did plc ', () => {
  it('should fail with not found', async () => {
    // @ts-expect-error - testing
    const out = await createPlcResolver()(
      'did:plc:ewvi7nxzyoun6zhxrhs64oizsss',
      parse('did:plc:ewvi7nxzyoun6zhxrhs64oizsss')
    )

    assert.strictEqual(out.didDocument, null)
    assert.strictEqual(out.didResolutionMetadata.error, 'notFound')
  })

  it('should resolve real ', async () => {
    const resolver = createPlcResolver()
    // @ts-expect-error - testing
    const result = await resolver(
      'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
      parse('did:plc:ewvi7nxzyoun6zhxrhs64oiz')
    )
    assert.deepStrictEqual(result.didDocument, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
      ],
      id: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
      alsoKnownAs: ['at://atproto.com'],
      verificationMethod: [
        {
          id: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#atproto',
          type: 'Multikey',
          controller: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
          publicKeyMultibase:
            'zQ3shunBKsXixLxKtC5qeSG9E4J5RkGN57im31pcTzbNQnm5w',
        },
      ],
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: 'https://enoki.us-east.host.bsky.network',
        },
      ],
    })
  })

  it('should resolve with resolver ', async () => {
    const doc = await resolve('did:plc:ewvi7nxzyoun6zhxrhs64oiz', resolver)
    assert.deepStrictEqual(doc, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
      ],
      id: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
      alsoKnownAs: ['at://atproto.com'],
      verificationMethod: [
        {
          id: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz#atproto',
          type: 'Multikey',
          controller: 'did:plc:ewvi7nxzyoun6zhxrhs64oiz',
          publicKeyMultibase:
            'zQ3shunBKsXixLxKtC5qeSG9E4J5RkGN57im31pcTzbNQnm5w',
        },
      ],
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: 'https://enoki.us-east.host.bsky.network',
        },
      ],
    })
  })
})
