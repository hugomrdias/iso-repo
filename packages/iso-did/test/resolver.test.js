import assert from 'assert'
import { Ed25519Signer } from '../src/signatures/signers/ed25519.js'
import { Resolver } from '../src/signatures/verifiers/resolver.js'
import * as EdDSA from '../src/signatures/verifiers/eddsa.js'
import * as ES256 from '../src/signatures/verifiers/ecdsa.js'

describe('Verifier Resolver', function () {
  it(`should verify`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...EdDSA.verifier,
    })
    const signer = await Ed25519Signer.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      ...signer,
    })
    assert.ok(verified)
  })

  it(`should verify with cache`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver(
      {
        ...EdDSA.verifier,
      },
      { cache: true }
    )
    const signer = await Ed25519Signer.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      ...signer,
    })
    assert.ok(verified)
  })

  it(`should verify with multiple verifiers`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver(
      {
        ...ES256.verifier,
        ...EdDSA.verifier,
      },
      { cache: true }
    )
    const signer = await Ed25519Signer.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      ...signer,
    })
    assert.ok(verified)
  })

  it(`should throw when no verifiers`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({})
    const signer = await Ed25519Signer.generate()
    const signature = await signer.sign(message)
    await assert.rejects(
      async () => {
        await resolver.verify({
          signature,
          message,
          ...signer,
        })
      },
      {
        message: 'Unsupported signature type "EdDSA"',
      }
    )
  })
})
