import assert from 'assert'
import { setup } from 'iso-web/msw'
import { http } from 'msw'
import { didWebResolver } from '../src/web.js'
import { parse } from '../src/index.js'

const server = setup([])

describe('did web ', function () {
  before(async () => {
    server.start({ quiet: true })
  })

  beforeEach(() => {
    server.resetHandlers()
  })

  after(() => {
    server.stop()
  })

  it(`should fail with not found`, async function () {
    server.use(
      http.get('https://example.com/.well-known/did.json', () => {
        return Response.error()
      })
    )
    // @ts-ignore
    const out = await didWebResolver(
      'did:web:example.com',
      parse('did:web:example.com')
    )

    // eslint-disable-next-line unicorn/no-null
    assert.strictEqual(out.didDocument, null)
    assert.strictEqual(out.didResolutionMetadata.error, 'notFound')
  })

  it(`should resolve real `, async function () {
    const document = {
      '@context': [
        'https://w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
      ],
      id: 'did:web:did.actor:alice',
      publicKey: [
        {
          id: 'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
          controller: 'did:web:did.actor:alice',
          type: 'Ed25519VerificationKey2018',
          publicKeyBase58: 'DK7uJiq9PnPnj7AmNZqVBFoLuwTjT1hFPrk6LSjZ2JRz',
        },
      ],
      authentication: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      assertionMethod: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      capabilityDelegation: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      capabilityInvocation: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      keyAgreement: [
        {
          id: 'did:web:did.actor:alice#zC8GybikEfyNaausDA4mkT4egP7SNLx2T1d1kujLQbcP6h',
          type: 'X25519KeyAgreementKey2019',
          controller: 'did:web:did.actor:alice',
          publicKeyBase58: 'CaSHXEvLKS6SfN9aBfkVGBpp15jSnaHazqHgLHp8KZ3Y',
        },
      ],
    }
    server.use(
      http.get('https://did.actor/alice/did.json', () => {
        return Response.json(document, { status: 200 })
      })
    )
    // @ts-ignore
    const out = await didWebResolver(
      'did:web:did.actor:alice',
      parse('did:web:did.actor:alice')
    )

    assert.deepStrictEqual(out.didDocument, {
      '@context': [
        'https://w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2018/v1',
      ],
      id: 'did:web:did.actor:alice',
      publicKey: [
        {
          id: 'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
          controller: 'did:web:did.actor:alice',
          type: 'Ed25519VerificationKey2018',
          publicKeyBase58: 'DK7uJiq9PnPnj7AmNZqVBFoLuwTjT1hFPrk6LSjZ2JRz',
        },
      ],
      authentication: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      assertionMethod: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      capabilityDelegation: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      capabilityInvocation: [
        'did:web:did.actor:alice#z6MkrmNwty5ajKtFqc1U48oL2MMLjWjartwc5sf2AihZwXDN',
      ],
      keyAgreement: [
        {
          id: 'did:web:did.actor:alice#zC8GybikEfyNaausDA4mkT4egP7SNLx2T1d1kujLQbcP6h',
          type: 'X25519KeyAgreementKey2019',
          controller: 'did:web:did.actor:alice',
          publicKeyBase58: 'CaSHXEvLKS6SfN9aBfkVGBpp15jSnaHazqHgLHp8KZ3Y',
        },
      ],
    })
  })
})
