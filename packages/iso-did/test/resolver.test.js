import assert from 'assert'
import { EdDSASigner } from '../src/signatures/signers/eddsa.js'
import { RSAOldSigner } from '../src/signatures/signers/rsa-old.js'
import { Resolver } from '../src/signatures/verifiers/resolver.js'
import * as EdDSA from '../src/signatures/verifiers/eddsa.js'
import * as ECDSA from '../src/signatures/verifiers/ecdsa.js'
import * as RSA from '../src/signatures/verifiers/rsa.js'
import * as RSA_OLD from '../src/signatures/verifiers/rsa-old.js'

describe('Verifier Resolver', function () {
  it(`should verify`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...EdDSA.verifier,
    })
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      ...signer,
    })
    assert.ok(verified)
  })

  it(`should verify from did`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...EdDSA.verifier,
    })
    const signer = await EdDSASigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      ...signer.did,
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
    const signer = await EdDSASigner.generate()
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
      ...signer,
    })
    assert.ok(verified)
  })

  it(`should throw when no verifiers`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({})
    const signer = await EdDSASigner.generate()
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

  it(`should verify rsa old`, async function () {
    const message = new TextEncoder().encode('hello world')
    const resolver = new Resolver({
      ...ECDSA.verifier,
      ...EdDSA.verifier,
      ...RSA_OLD.verifier,
      ...RSA.verifier,
    })
    const signer = await RSAOldSigner.generate()
    const signature = await signer.sign(message)
    const verified = await resolver.verify({
      signature,
      message,
      ...signer,
    })
    assert.ok(verified)
  })
})
