import assert from 'assert'
import { utf8 } from 'iso-base/utf8'
import { DIDPkh } from 'iso-did/pkh'
import { privateKeyToAccount } from 'viem/accounts'
import * as EIP191 from '../src/verifiers/eip191.js'
import { Resolver } from '../src/verifiers/resolver.js'

const PRIVATE_KEY =
  '0xecec2004b1aed144389c96304904dddd35a1e35cab82226ce4e6ea78b1df83d2'

describe('Verifier eip191', () => {
  it('should generate a new signer from jwk', async () => {
    const account = privateKeyToAccount(PRIVATE_KEY)
    const msg = utf8.decode('hello world')
    const did = DIDPkh.fromAddress(account.address)

    const sig = await account.signMessage({
      message: {
        raw: msg,
      },
    })

    const verified = EIP191.verify({
      signature: EIP191.hexToBytes(sig),
      message: msg,
      did,
    })

    assert.ok(verified)

    // verify with resolver
    const resolver = new Resolver({
      ...EIP191.verifier,
    })
    const verified2 = await resolver.verify({
      signature: EIP191.hexToBytes(sig),
      message: msg,
      did,
      type: 'EIP191',
    })
    assert.ok(verified2)
  })
})
