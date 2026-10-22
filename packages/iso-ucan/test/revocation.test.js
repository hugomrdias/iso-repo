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
import { signaturePayload } from '../src/utils.js'
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
 * @param {boolean} [strict]
 */
function verifies(dlg, signature, strict) {
  return verifierResolver.verify({
    signature,
    message: dagCbor.encode(signaturePayload(dlg.envelope)),
    did: /** @type {any} */ (signers)[dlg.envelope.alg],
    type: dlg.envelope.alg,
    strict,
  })
}

for (const alg of /** @type {const} */ ([
  'ES256',
  'ES384',
  'ES512',
  'ES256K',
  'EIP191',
])) {
  revocation(
    `should reject a revoked ${alg} delegation re-encoded with high S`,
    async () => {
      const dlg = await delegate(signers[alg])
      const flipped = mocks.flipS(alg, dlg.envelope.signature)
      const bytes = reencode(dlg, flipped)

      // ES256K verifiers never accept high S, the others only reject it in strict mode
      assert.equal(
        await verifies(dlg, flipped, false).catch(() => false),
        alg !== 'ES256K'
      )
      assert.equal(await verifies(dlg, flipped, true), false)

      await assert.rejects(Delegation.from({ bytes, verifierResolver }), {
        message: 'UCAN signature verification failed',
      })
    }
  )
}

revocation('should reject an EIP191 delegation with v as 0/1', async () => {
  const dlg = await delegate(signers.EIP191)
  const signature = new Uint8Array(dlg.envelope.signature)
  assert.ok(signature[64] === 27 || signature[64] === 28)
  signature[64] -= 27

  await assert.rejects(
    Delegation.from({ bytes: reencode(dlg, signature), verifierResolver }),
    { message: 'UCAN signature verification failed' }
  )
})

revocation('should reject a revoked delegation by CID', async () => {
  const dlg = await delegate(signers.ES256)
  /** @param {import('multiformats').CID} c */
  const isRevoked = async (c) => c.equals(dlg.cid)

  await assert.rejects(
    Delegation.from({ bytes: dlg.bytes, verifierResolver, isRevoked }),
    { message: 'UCAN revoked' }
  )
  await assert.rejects(dlg.validate({ verifierResolver, isRevoked }), {
    message: 'UCAN revoked',
  })
})
