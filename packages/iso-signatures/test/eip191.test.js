import assert from 'assert'
import { utf8 } from 'iso-base/utf8'
import { DIDPkh } from 'iso-did/pkh'
import { privateKeyToAccount } from 'viem/accounts'
import { ES256KSigner } from '../src/signers/es256k.js'
import * as EIP191 from '../src/verifiers/eip191.js'
import { Resolver } from '../src/verifiers/resolver.js'

const PRIVATE_KEY =
  '0xecec2004b1aed144389c96304904dddd35a1e35cab82226ce4e6ea78b1df83d2'
const OTHER_PRIVATE_KEY =
  '0x2222222222222222222222222222222222222222222222222222222222222222'

const account = privateKeyToAccount(PRIVATE_KEY)
const msg = utf8.decode('hello world')

/**
 * @param {`0x${string}`} privateKey
 * @param {Uint8Array} message
 */
async function sign(privateKey, message) {
  const sig = await privateKeyToAccount(privateKey).signMessage({
    message: { raw: message },
  })
  return EIP191.hexToBytes(sig)
}

describe('Verifier eip191', () => {
  it('should verify a signature from the did:pkh address', async () => {
    const did = DIDPkh.fromAddress(account.address)
    const signature = await sign(PRIVATE_KEY, msg)

    const verified = await EIP191.verify({ signature, message: msg, did })
    assert.equal(verified, true)

    const resolver = new Resolver({
      ...EIP191.verifier,
    })
    const verified2 = await resolver.verify({
      signature,
      message: msg,
      did,
      type: 'EIP191',
    })
    assert.equal(verified2, true)
  })

  it('should verify when the did:pkh address is lowercase', async () => {
    const did = DIDPkh.fromAddress(
      /** @type {`0x${string}`} */ (account.address.toLowerCase())
    )
    const signature = await sign(PRIVATE_KEY, msg)

    const verified = await EIP191.verify({ signature, message: msg, did })
    assert.equal(verified, true)
  })

  it('should not verify a signature from a different address', async () => {
    const did = DIDPkh.fromAddress(account.address)
    const signature = await sign(OTHER_PRIVATE_KEY, msg)

    const verified = await EIP191.verify({ signature, message: msg, did })
    assert.equal(verified, false)

    const resolver = new Resolver({
      ...EIP191.verifier,
    })
    const verified2 = await resolver.verify({
      signature,
      message: msg,
      did,
      type: 'EIP191',
    })
    assert.equal(verified2, false)
  })

  it('should not verify a signature for a different message', async () => {
    const did = DIDPkh.fromAddress(account.address)
    const signature = await sign(PRIVATE_KEY, msg)

    const verified = await EIP191.verify({
      signature,
      message: utf8.decode('hello world!'),
      did,
    })
    assert.equal(verified, false)
  })

  it('should reject a non did:pkh DID', async () => {
    const signer = ES256KSigner.generate()
    const signature = await sign(PRIVATE_KEY, msg)

    await assert.rejects(
      EIP191.verify({ signature, message: msg, did: signer }),
      /Invalid DID/
    )
  })

  it('should reject an invalid signature length', async () => {
    const did = DIDPkh.fromAddress(account.address)
    const signature = await sign(PRIVATE_KEY, msg)

    await assert.rejects(
      EIP191.verify({ signature: signature.slice(0, 64), message: msg, did }),
      /Invalid signature length/
    )
  })
})
