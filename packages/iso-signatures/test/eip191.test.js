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

/**
 * Sign messages until one produces a signature with the given y parity.
 *
 * @param {0 | 1} yParity
 */
async function signWithParity(yParity) {
  for (let i = 0; i < 64; i++) {
    const message = utf8.decode(`hello world ${i}`)
    const signature = await sign(PRIVATE_KEY, message)
    if (signature[64] === 27 + yParity) {
      return { signature, message }
    }
  }
  throw new Error(`No signature with y parity ${yParity} found`)
}

/**
 * @param {Uint8Array} signature
 * @param {number} v
 */
function withV(signature, v) {
  const out = signature.slice()
  out[64] = v
  return out
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

  for (const yParity of /** @type {const} */ ([0, 1])) {
    for (const v of [yParity, 27 + yParity]) {
      it(`should verify a signature with v = ${v}`, async () => {
        const did = DIDPkh.fromAddress(account.address)
        const { signature, message } = await signWithParity(yParity)

        const verified = await EIP191.verify({
          signature: withV(signature, v),
          message,
          did,
        })
        assert.equal(verified, true)
      })
    }
  }

  // EIP-155 style values decode to a valid y parity in ox's vToYParity,
  // but are not valid for personal messages
  for (const v of [35, 36, 37, 255]) {
    it(`should reject a signature with v = ${v}`, async () => {
      const did = DIDPkh.fromAddress(account.address)
      // 35 + chainId * 2 + yParity, so match the parity for an otherwise valid signature
      const { signature, message } = await signWithParity(
        /** @type {0 | 1} */ ((v - 35) % 2)
      )

      await assert.rejects(
        EIP191.verify({ signature: withV(signature, v), message, did }),
        /Invalid signature recovery byte/
      )
    })
  }

  it('should reject a signature with v = 2', async () => {
    const did = DIDPkh.fromAddress(account.address)
    const signature = await sign(PRIVATE_KEY, msg)

    await assert.rejects(
      EIP191.verify({ signature: withV(signature, 2), message: msg, did }),
      /Invalid signature recovery byte/
    )
  })
})
