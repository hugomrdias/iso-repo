import assert from 'assert'
import { EdDSASigner } from '../src/signers/eddsa.js'
import { RSASigner } from '../src/signers/rsa.js'
import * as ECDSA from '../src/verifiers/ecdsa.js'
import * as EdDSA from '../src/verifiers/eddsa.js'
import { Resolver } from '../src/verifiers/resolver.js'
import * as RSA from '../src/verifiers/rsa.js'

describe('Verifier Resolver', () => {
  it('should verify', async () => {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...EdDSA.verifier,
    })
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      did: signer,
      type: 'Ed25519',
    })
    assert.ok(verified)
  })

  it('should verify from did', async () => {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...EdDSA.verifier,
    })
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      did: signer,
      type: 'Ed25519',
    })
    assert.ok(verified)
  })

  it('should verify with cache', async () => {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver(
      {
        ...EdDSA.verifier,
      },
      { cache: true }
    )
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      did: signer,
      type: 'Ed25519',
    })
    assert.ok(verified)
  })

  it('should verify with multiple verifiers', async () => {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver(
      {
        ...ECDSA.verifier,
        ...EdDSA.verifier,
      },
      { cache: true }
    )
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      did: signer,
      type: 'Ed25519',
    })
    assert.ok(verified)
  })

  it('should throw when no verifiers', async () => {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({})
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    await assert.rejects(
      async () => {
        await resolver.verify({
          signature,
          message,
          did: signer,
          type: 'Ed25519',
        })
      },
      {
        message: 'Unsupported signature type "Ed25519"',
      }
    )
  })

  it('should verify rsa old', async () => {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...ECDSA.verifier,
      ...EdDSA.verifier,
      ...RSA.verifier,
    })
    const signer = await RSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      did: signer,
      type: 'RS256',
    })
    assert.ok(verified)
  })
})
