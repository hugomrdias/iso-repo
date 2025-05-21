import assert from 'assert'
import { base58btc } from 'iso-base/base-x'
import { ES256KSigner } from '../src/signers/es256k.js'
import * as ECDSA from '../src/verifiers/ecdsa.js'

describe('Verifier ES256K', () => {
  it('should generate a new signer from jwk', () => {
    const signer = ES256KSigner.importJwk({
      kty: 'EC',
      crv: 'secp256k1',
      x: 'TEIJN9vnTq1EXMkqzo7yN_867-foKc2pREv45Fw_QA8',
      y: '9yiymlzdxKCiRbYq7p-ArRB-C1ytjHE-eb7RDTi6rVc',
      d: 'J5yKm7OXFsXDEutteGYeT0CAfQJwIlHLSYkQxKtgiyo',
    })

    // https://github.com/w3c-ccg/did-key-spec/blob/1b4f72d577faef66d4ecb0103ce25472ed353f3a/test-vectors/secp256k1.json#L202
    assert.equal(
      signer.did,
      'did:key:zQ3shjmnWpSDEbYKpaFm4kTs9kXyqG6N2QwCYHNPP4yubqgJS'
    )
  })

  it('should generate a new signer', async () => {
    // https://github.com/w3c-ccg/did-key-spec/blob/1b4f72d577faef66d4ecb0103ce25472ed353f3a/test-vectors/secp256k1.json#L162C4-L162C61
    const signer = ES256KSigner.generate(
      base58btc.decode('2aA6WgZnPiVMBX3LvKSTg3KaFKyzfKpvEacixB3yyTgv')
    )

    const msg = new TextEncoder().encode('hello')
    const sig = await signer.sign(msg)

    assert.equal(sig.length, 64)

    const verified = await ECDSA.verify('ES256K', {
      signature: sig,
      message: msg,
      did: signer,
    })

    assert.equal(verified, true)

    assert.equal(
      signer.did,
      'did:key:zQ3shptjE6JwdkeKN4fcpnYQY3m9Cet3NiHdAfpvSUZBFoKBj'
    )
  })
})
