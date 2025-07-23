import { sha256 } from '@noble/hashes/sha256'
import assert from 'assert'
import * as EC from 'iso-base/ec-compression'
import { base64pad, base64url } from 'iso-base/rfc4648'
import { setup } from 'iso-web/msw'
import { http } from 'msw'
import { DID, dereference, parse, Resolver, resolve } from '../src/index.js'
import { DIDKey } from '../src/key.js'
import { didWebResolver } from '../src/web.js'

const resolver = new Resolver({
  web: didWebResolver,
})

const server = setup([
  http.get('https://localhost:3000/.well-known/did.json', () => {
    return Response.json(
      {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/jws-2020/v1',
        ],
        id: 'did:web:localhost%3A3000',
        verificationMethod: [
          {
            id: 'did:web:localhost%3A3000#key-0',
            type: 'JsonWebKey2020',
            controller: 'did:web:localhost%3A3000',
            publicKeyJwk: {
              kty: 'OKP',
              crv: 'Ed25519',
              x: 'VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ',
            },
          },
          {
            id: 'did:web:localhost%3A3000#key-41',
            type: 'JsonWebKey2020',
            controller: 'did:web:localhost%3A3000',
            publicKeyJwk: {
              kty: 'EC',
              crv: 'P-256',
              x: 'igrFmi0whuihKnj9R3Om1SoMph72wUGeFaBbzG2vzns',
              y: 'efsX5b10x8yjyrj4ny3pGfLcY7Xby1KzgqOdqnsrJIM',
            },
          },
          {
            id: 'did:web:localhost%3A3000#key-5',
            type: 'JsonWebKey2020',
            controller: 'did:web:localhost%3A3000',
            publicKeyJwk: {
              kty: 'EC',
              crv: 'P-384',
              x: 'lInTxl8fjLKp_UCrxI0WDklahi-7-_6JbtiHjiRvMvhedhKVdHBfi2HCY8t_QJyc',
              y: 'y6N1IC-2mXxHreETBW7K3mBcw0qGr3CWHCs-yl09yCQRLcyfGv7XhqAngHOu51Zv',
            },
          },
          {
            id: 'did:web:localhost%3A3000#key-7',
            type: 'JsonWebKey2020',
            controller: 'did:web:localhost%3A3000',
            publicKeyJwk: {
              kty: 'RSA',
              e: 'AQAB',
              n: 'UkhWaGJGOUZRMTlFVWtKSElBdENGV2hlU1F2djFNRXh1NVJMQ01UNGpWazlraEpLdjhKZU1YV2UzYldIYXRqUHNrZGYyZGxhR2tXNVFqdE9uVUtMNzQybXZyNHRDbGRLUzNVTElhVDFoSkluTUhIeGoyZ2N1Yk82ZUVlZ0FDUTRRU3U5TE8wSC1MTV9MM0RzUkFCQjdRamE4SGVjcHl1c3BXMVR1X0RicXhjU253ZW5kYW13TDUyVjE3ZUtobE80dVh3djJIRmx4dWZGSE0wS21DSnVqSUt5QXhqRF9tM3FfX0lpSFVWSEQxdERJRXZMUGhHOUF6c24zajk1ZC1zYU',
            },
          },
        ],
      },
      { status: 200 }
    )
  }),
])

describe('did', () => {
  before(async () => {
    await server.start({ quiet: true })
  })

  beforeEach(() => {
    server.resetHandlers()
  })

  after(() => {
    server.stop()
  })

  it('should resolve did:key', async () => {
    const out = await resolve(
      'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp'
    )
    assert.deepStrictEqual(out, {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/multikey/v1',
      ],
      id: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      verificationMethod: [
        {
          controller:
            'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
          id: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
          publicKeyMultibase:
            'z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
          type: 'MultiKey',
        },
      ],
      authentication: [
        'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      ],
      assertionMethod: [
        'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      ],
      capabilityDelegation: [
        'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      ],
      capabilityInvocation: [
        'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      ],
    })
  })

  it('should deref did:key', async () => {
    const out = await dereference(
      parse('did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp')
    )
    assert.deepStrictEqual(out, {
      controller: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      id: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      publicKeyMultibase: 'z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      type: 'MultiKey',
    })
  })

  it('should deref from did:key instance', async () => {
    const out = await dereference(
      DIDKey.fromString(
        'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp'
      )
    )
    assert.deepStrictEqual(out, {
      id: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp#z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      controller: 'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      publicKeyMultibase: 'z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp',
      type: 'MultiKey',
    })
  })

  it('should create a valid verifiable did', async () => {
    const out = await DID.fromString(
      'did:key:z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp'
    )
    assert.deepStrictEqual(
      out.verifiableDid.publicKey,
      base64pad.decode('O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik=')
    )
  })

  it('should create a real verifiable did OKP', async () => {
    server.use(
      http.get('https://demo.spruceid.com/.well-known/did.json', () => {
        return Response.json(
          {
            '@context': [
              'https://www.w3.org/ns/did/v1',
              {
                '@id': 'https://w3id.org/security#publicKeyJwk',
                '@type': '@json',
              },
            ],
            id: 'did:web:demo.spruceid.com',
            verificationMethod: [
              {
                id: 'did:web:demo.spruceid.com#_t-v-Ep7AtkELhhvAzCCDzy1O5Bn_z1CVFv9yiRXdHY',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:web:demo.spruceid.com',
                publicKeyJwk: {
                  kty: 'OKP',
                  crv: 'Ed25519',
                  x: '2yv3J-Sf263OmwDLS9uFPTRD0PzbvfBGKLiSnPHtXIU',
                },
              },
            ],
            authentication: [
              'did:web:demo.spruceid.com#_t-v-Ep7AtkELhhvAzCCDzy1O5Bn_z1CVFv9yiRXdHY',
            ],
            assertionMethod: [
              'did:web:demo.spruceid.com#_t-v-Ep7AtkELhhvAzCCDzy1O5Bn_z1CVFv9yiRXdHY',
            ],
          },
          { status: 200 }
        )
      })
    )
    const out = await DID.fromString(
      'did:web:demo.spruceid.com#_t-v-Ep7AtkELhhvAzCCDzy1O5Bn_z1CVFv9yiRXdHY',
      resolver
    )
    const x = base64url.encode(out.verifiableDid.publicKey)
    assert.strictEqual(x, '2yv3J-Sf263OmwDLS9uFPTRD0PzbvfBGKLiSnPHtXIU')

    const thumbprint = base64url.encode(
      sha256(`{"crv":"Ed25519","kty":"OKP","x":"${x}"}`)
    )
    assert.strictEqual(
      thumbprint,
      '_t-v-Ep7AtkELhhvAzCCDzy1O5Bn_z1CVFv9yiRXdHY'
    )
  })

  it('should create a verifiable did from EC 256 jwk', async () => {
    const host = encodeURIComponent('localhost:3000')
    const out = await DID.fromString(`did:web:${host}#key-41`, resolver)
    const uncompressed = EC.decompress(out.verifiableDid.publicKey)
    const x = base64url.encode(uncompressed.subarray(1, 33))
    const y = base64url.encode(uncompressed.subarray(33, 66))
    assert.strictEqual(x, 'igrFmi0whuihKnj9R3Om1SoMph72wUGeFaBbzG2vzns')
    assert.strictEqual(y, 'efsX5b10x8yjyrj4ny3pGfLcY7Xby1KzgqOdqnsrJIM')
  })

  it('should create a verifiable did from EC 384 jwk', async () => {
    const host = encodeURIComponent('localhost:3000')
    const out = await DID.fromString(`did:web:${host}#key-5`, resolver)
    const uncompressed = EC.decompress(out.verifiableDid.publicKey, 'P-384')
    const x = base64url.encode(uncompressed.subarray(1, 49))
    const y = base64url.encode(uncompressed.subarray(49))
    assert.strictEqual(
      x,
      'lInTxl8fjLKp_UCrxI0WDklahi-7-_6JbtiHjiRvMvhedhKVdHBfi2HCY8t_QJyc'
    )
    assert.strictEqual(
      y,
      'y6N1IC-2mXxHreETBW7K3mBcw0qGr3CWHCs-yl09yCQRLcyfGv7XhqAngHOu51Zv'
    )

    assert.strictEqual(out.toString(), `did:web:${host}#key-5`)
    assert.strictEqual(out.did, `did:web:${host}`)
  })
})
