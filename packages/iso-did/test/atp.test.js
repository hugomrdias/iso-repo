import assert from 'assert'
import {
  createAtpResolver,
  resolveDNS,
  resolveHttp,
  resolvePlcDid,
} from '../src/atp.js'
import { parse, resolve as resolveDid } from '../src/index.js'
import { didWebResolver } from '../src/web.js'

describe('did atp ', () => {
  it('should fail with not found', async () => {
    // @ts-ignore
    const out = await createAtpResolver()(
      'did:plc:ewvi7nxzyoun6zhxrhs64oizsss',
      parse('did:plc:ewvi7nxzyoun6zhxrhs64oizsss')
    )

    assert.strictEqual(out.didDocument, null)
    assert.strictEqual(out.didResolutionMetadata.error, 'notFound')
  })

  it('should resolve dns ', async () => {
    const did = await resolveDNS({
      parsed: parse('did:atp:robin.berjon.com'),
    })
    assert.strictEqual(did, 'did:plc:izttpdp3l6vss5crelt5kcux')
  })

  it('should resolve well-known', async () => {
    const did = await resolveHttp({
      parsed: parse('did:atp:retr0.id'),
    })
    assert.strictEqual(did, 'did:plc:vwzwgnygau7ed7b7wt5ux7y2')
  })

  it('should resolve atp dns to did:plc', async () => {
    const did = await resolvePlcDid({
      parsed: parse('did:atp:robin.berjon.com'),
    })

    assert.strictEqual(did, 'did:plc:izttpdp3l6vss5crelt5kcux')
  })
  it('should resolve atp well-known to did:plc', async () => {
    const did = await resolvePlcDid({
      parsed: parse('did:atp:retr0.id'),
    })

    assert.strictEqual(did, 'did:plc:vwzwgnygau7ed7b7wt5ux7y2')
  })

  it('should resolve did:web', async () => {
    const did = await didWebResolver(
      'did:web:retr0.id',
      parse('did:web:retr0.id'),
      // @ts-ignore
      {},
      {}
    )

    assert.deepStrictEqual(did.didDocument, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
      ],
      id: 'did:web:retr0.id',
      alsoKnownAs: ['at://didwebtest2.bsky.social'],
      verificationMethod: [
        {
          id: 'did:web:retr0.id#atproto',
          type: 'Multikey',
          controller: 'did:web:retr0.id',
          publicKeyMultibase:
            'zQ3shPp74h4BoAZ3bEBLfBBGiohF9EsUks1CYr79nSLHu3zjN',
        },
      ],
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: 'https://oyster.us-east.host.bsky.network',
        },
      ],
    })
  })

  it('should resolve did:atp full', async () => {
    const did2 = await resolveDid('did:atp:retr0.id', {
      resolvers: {
        atp: createAtpResolver('https://plc.directory'),
      },
    })

    assert.deepStrictEqual(did2, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
      ],
      id: 'did:plc:vwzwgnygau7ed7b7wt5ux7y2',
      alsoKnownAs: ['at://retr0.id'],
      verificationMethod: [
        {
          id: 'did:plc:vwzwgnygau7ed7b7wt5ux7y2#atproto',
          type: 'Multikey',
          controller: 'did:plc:vwzwgnygau7ed7b7wt5ux7y2',
          publicKeyMultibase:
            'zQ3shaxnaNhKA1zSvif5BzJWMc6yMTVKAFnxpyaLZaU2qharU',
        },
      ],
      service: [
        {
          id: '#atproto_pds',
          type: 'AtprotoPersonalDataServer',
          serviceEndpoint: 'https://shiitake.us-east.host.bsky.network',
        },
      ],
    })
  })
})
