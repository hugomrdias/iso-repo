import assert from 'assert'
import { setup } from 'iso-web/msw'
import { http } from 'msw'
import { didFissionResolver, format } from '../src/fission.js'
import { DID, parse, Resolver } from '../src/index.js'

const server = setup()

const resolver = new Resolver({
  fission: didFissionResolver,
})

describe('did fission ', () => {
  before(async () => {
    await server.start()
  })

  beforeEach(() => {
    server.resetHandlers()
  })

  after(() => {
    server.stop()
  })

  it('should fail with not found', async () => {
    const host = 'http://example.com:4400'
    const didString = format(host)
    server.use(
      http.get('https://example.com:4400/dns-query', () => {
        return Response.error()
      })
    )

    // @ts-expect-error - testing
    const out = await didFissionResolver(didString, parse(didString))

    // eslint-disable-next-line unicorn/no-null
    assert.strictEqual(out.didDocument, null)
    assert.strictEqual(out.didResolutionMetadata.error, 'notFound')
  })

  it('should fail with not found when the TXT record does not exist', async () => {
    const host = 'http://localhost:4401'
    const didString = format(host)
    server.use(
      http.get(`${host}/dns-query`, () => {
        return Response.json({
          Status: 0,
          Question: [{ name: '_did.localhost.', type: 16 }],
          Authority: [
            {
              name: 'localhost.',
              type: 6,
              TTL: 300,
              data: 'ns1.localhost. admin.localhost. 2024010101 7200 3600 1209600 300',
            },
          ],
        })
      })
    )

    // @ts-expect-error - testing
    const out = await didFissionResolver(didString, parse(didString))

    // eslint-disable-next-line unicorn/no-null
    assert.strictEqual(out.didDocument, null)
    assert.strictEqual(out.didResolutionMetadata.error, 'notFound')
  })

  it('should resolve real ', async () => {
    const host = 'http://localhost:4400'
    const didString = format(host)

    server.use(
      http.get(`${host}/dns-query`, () => {
        return Response.json(
          {
            Status: 0,
            TC: false,
            RD: true,
            RA: false,
            AD: false,
            CD: false,
            Question: [
              {
                name: '_did.localhost.',
                type: 16,
              },
            ],
            Answer: [
              {
                name: '_did.localhost.',
                type: 16,
                TTL: 1800,
                data: 'did:key:z6MkmPDXimDnjrKPrvhmP85aUnPVMvDvyqWd9XXqYxALyFcC',
              },
            ],
          },
          { status: 200 }
        )
      })
    )

    // @ts-expect-error - testing
    const resolution = await didFissionResolver(didString, parse(didString))

    assert.deepStrictEqual(resolution.didDocument, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: didString,
      verificationMethod: [
        {
          id: 'did:fission:localhost%3A4400#localhost%3A4400',
          controller: didString,
          type: 'MultiKey',
          publicKeyMultibase:
            'z6MkmPDXimDnjrKPrvhmP85aUnPVMvDvyqWd9XXqYxALyFcC',
        },
      ],
      authentication: ['did:fission:localhost%3A4400#localhost%3A4400'],
      assertionMethod: ['did:fission:localhost%3A4400#localhost%3A4400'],
      capabilityDelegation: ['did:fission:localhost%3A4400#localhost%3A4400'],
      capabilityInvocation: ['did:fission:localhost%3A4400#localhost%3A4400'],
    })

    const did = await DID.fromString(didString, resolver)

    assert.strictEqual(
      did.verifiableDid.toString(),
      'did:key:z6MkmPDXimDnjrKPrvhmP85aUnPVMvDvyqWd9XXqYxALyFcC'
    )
  })
})
