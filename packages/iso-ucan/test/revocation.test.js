import * as dagCbor from '@ipld/dag-cbor'
import { ECDSASigner } from 'iso-signatures/signers/ecdsa.js'
import { EIP191Signer } from 'iso-signatures/signers/eip191.js'
import { ES256KSigner } from 'iso-signatures/signers/es256k.js'
import * as ECDSA from 'iso-signatures/verifiers/ecdsa.js'
import * as EIP191 from 'iso-signatures/verifiers/eip191.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { assert, suite } from 'playwright-test/taps'
import { privateKeyToAccount } from 'viem/accounts'
import { Delegation } from '../src/delegation.js'
import * as Envelope from '../src/envelope.js'
import {
  cid,
  equivalentCids,
  equivalentSignatures,
  signaturePayload,
} from '../src/utils.js'
import * as mocks from './mocks.js'

const revocation = suite('revocation')

const verifierResolver = new Resolver({
  ...ECDSA.verifier,
  ...EIP191.verifier,
})

const account = privateKeyToAccount(
  '0xecec2004b1aed144389c96304904dddd35a1e35cab82226ce4e6ea78b1df83d2'
)

const eip191 = new EIP191Signer(
  /** @type {any} */ ({
    /** @param {{params: [`0x${string}`, string]}} args */
    request: ({ params }) =>
      account.signMessage({ message: { raw: params[0] } }),
  }),
  account.address
)

const signers = {
  ES256: await ECDSASigner.generate('P-256'),
  ES384: await ECDSASigner.generate('P-384'),
  ES512: await ECDSASigner.generate('P-521'),
  ES256K: ES256KSigner.generate(),
  EIP191: eip191,
}

/**
 * @param {import('../src/types.js').ISigner<any>} iss
 */
function delegate(iss) {
  return Delegation.create({
    iss,
    aud: mocks.alice.did,
    sub: iss.did,
    pol: [],
    cmd: '/pay',
  })
}

/**
 * Re-encode a delegation with another signature.
 *
 * @param {Delegation} dlg
 * @param {Uint8Array} signature
 */
function reencode(dlg, signature) {
  return Envelope.encode({
    signature,
    // @ts-expect-error - signaturePayload returns a generic record
    signaturePayload: signaturePayload(dlg.envelope),
  })
}

/**
 * @param {Delegation} dlg
 * @param {Uint8Array} signature
 */
function verifies(dlg, signature) {
  return verifierResolver.verify({
    signature,
    message: dagCbor.encode(signaturePayload(dlg.envelope)),
    did: /** @type {any} */ (signers)[dlg.envelope.alg],
    type: dlg.envelope.alg,
  })
}

for (const alg of /** @type {const} */ (['ES256', 'ES384', 'ES512'])) {
  revocation(`${alg} has two valid signatures per payload`, async () => {
    const dlg = await delegate(signers[alg])
    const sigs = equivalentSignatures(alg, dlg.envelope.signature)

    assert.equal(sigs.length, 2)
    assert.deepEqual(sigs[0], dlg.envelope.signature)
    for (const sig of sigs) {
      assert.equal(await verifies(dlg, sig), true)
    }
  })
}

revocation('ES256K only verifies the low-S signature', async () => {
  const dlg = await delegate(signers.ES256K)
  const [original, flipped] = equivalentSignatures(
    'ES256K',
    dlg.envelope.signature
  )

  assert.equal(await verifies(dlg, original), true)
  assert.equal(await verifies(dlg, flipped).catch(() => false), false)
})

revocation('EIP191 has four valid signatures per payload', async () => {
  const dlg = await delegate(signers.EIP191)
  const sigs = equivalentSignatures('EIP191', dlg.envelope.signature)

  assert.equal(sigs.length, 4)
  assert.deepEqual(sigs[0], dlg.envelope.signature)
  assert.deepEqual(
    sigs.map((s) => s[64]).sort(),
    [0, 1, 27, 28],
    'expected every v encoding'
  )
  for (const sig of sigs) {
    assert.equal(await verifies(dlg, sig), true)
  }
})

revocation('Ed25519 has a single signature per payload', async () => {
  const dlg = await delegate(mocks.bob)

  assert.deepEqual(equivalentSignatures('Ed25519', dlg.envelope.signature), [
    dlg.envelope.signature,
  ])
})

revocation('equivalentCids starts with the envelope CID', async () => {
  const dlg = await delegate(signers.ES256)
  const cids = await equivalentCids(dlg.envelope)

  assert.equal(cids.length, 2)
  assert.equal(cids[0].toString(), dlg.cid.toString())
})

revocation(
  'should reject a revoked ES256 delegation re-encoded with a malleated signature',
  async () => {
    const dlg = await delegate(signers.ES256)
    const revoked = new Set([dlg.cid.toString()])
    /** @param {import('multiformats').CID} c */
    const isRevoked = async (c) => revoked.has(c.toString())

    const [, flipped] = equivalentSignatures('ES256', dlg.envelope.signature)
    const bytes = reencode(dlg, flipped)
    const malleated = await Delegation.from({ bytes, verifierResolver })
    assert.notEqual(malleated.cid.toString(), dlg.cid.toString())

    await assert.rejects(
      Delegation.from({ bytes, verifierResolver, isRevoked }),
      {
        message: 'UCAN revoked',
      }
    )
    await assert.rejects(malleated.validate({ verifierResolver, isRevoked }), {
      message: 'UCAN revoked',
    })
  }
)

revocation(
  'should reject a revoked EIP191 delegation re-encoded with any v',
  async () => {
    const dlg = await delegate(signers.EIP191)
    const sig = dlg.envelope.signature
    const revoked = new Set([dlg.cid.toString()])
    /** @param {import('multiformats').CID} c */
    const isRevoked = async (c) => revoked.has(c.toString())

    // EIP-155 style v, accepted by the verifier but never issued by signers
    const parity = sig[64] === 0 || sig[64] === 27 ? 0 : 1
    const eip155 = new Uint8Array([...sig.subarray(0, 64), 37 + parity])

    for (const signature of [
      ...equivalentSignatures('EIP191', sig).slice(1),
      eip155,
    ]) {
      const bytes = reencode(dlg, signature)
      await Delegation.from({ bytes, verifierResolver })
      await assert.rejects(
        Delegation.from({ bytes, verifierResolver, isRevoked }),
        { message: 'UCAN revoked' },
        `v=${signature[64]}`
      )
    }
  }
)

revocation(
  'should reject the original when a malleated CID is revoked',
  async () => {
    const dlg = await delegate(signers.EIP191)
    const [, , , last] = equivalentSignatures('EIP191', dlg.envelope.signature)
    const revokedCid = await cid({ ...dlg.envelope, signature: last })
    /** @param {import('multiformats').CID} c */
    const isRevoked = async (c) => c.equals(revokedCid)

    await assert.rejects(
      Delegation.from({ bytes: dlg.bytes, verifierResolver, isRevoked }),
      { message: 'UCAN revoked' }
    )
  }
)
