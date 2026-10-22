import { ECDSASigner } from 'iso-signatures/signers/ecdsa.js'
import { assert, suite } from 'playwright-test/taps'
import * as Envelope from '../src/envelope.js'
import { Invocation } from '../src/invocation.js'
import { KVReplayStore } from '../src/replay.js'
import { nowInSeconds } from '../src/utils.js'
import * as mocks from './mocks.js'

const replay = suite('replay')

/**
 * Re-encode an ES256 invocation with the other valid signature `(r, n - s)`.
 *
 * @param {Invocation} inv
 */
function malleate(inv) {
  const signature = mocks.flipS('ES256', inv.envelope.signature)
  const decoded = Envelope.decode({ envelope: inv.bytes })
  return Envelope.encode({
    signature,
    signaturePayload: Envelope.getSignaturePayload({
      spec: 'inv',
      version: decoded.version,
      signatureType: decoded.alg,
      payload: decoded.payload,
    }),
  })
}

/**
 * @param {import('../src/types.js').ISigner<any>} [iss]
 * @param {Partial<import('../src/types.js').CapabilityInvokeOptions<any>>} [options]
 */
async function setup(iss = mocks.alice, options = {}) {
  const store = mocks.createStore()
  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: iss.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const inv = await mocks.AccountCreateCap.invoke({
    iss,
    sub: mocks.bob.did,
    args: { type: 'account', properties: { name: 'John Doe' } },
    store,
    verifierResolver: mocks.verifierResolver,
    ...options,
  })

  /**
   * @param {Uint8Array} bytes
   * @param {Partial<import('../src/types.js').InvocationFromOptions>} [opts]
   */
  const from = (bytes, opts = {}) =>
    Invocation.from({
      bytes,
      audience: mocks.bob,
      verifierResolver: mocks.verifierResolver,
      resolveProof: (cid) => store.resolveProof(cid),
      ...opts,
    })

  return { store, inv, from }
}

replay('should reject a replayed invocation', async () => {
  const { inv, from } = await setup()
  const replayStore = new KVReplayStore()

  const first = await from(inv.bytes, { replayStore })
  assert.equal(first.cid.toString(), inv.cid.toString())

  await assert.rejects(from(inv.bytes, { replayStore }), {
    message: `UCAN Invocation replay detected, already seen ${inv.cid}`,
  })
})

replay('should accept distinct invocations of the same command', async () => {
  const { store, inv, from } = await setup()
  const replayStore = new KVReplayStore()
  const other = await mocks.AccountCreateCap.invoke({
    iss: mocks.alice,
    sub: mocks.bob.did,
    args: { type: 'account', properties: { name: 'John Doe' } },
    store,
    verifierResolver: mocks.verifierResolver,
  })

  assert.notEqual(inv.cid.toString(), other.cid.toString())
  await from(inv.bytes, { replayStore })
  await from(other.bytes, { replayStore })
})

replay('should not record invocations that fail validation', async () => {
  const { inv, from } = await setup()
  const replayStore = new KVReplayStore()

  await assert.rejects(
    from(inv.bytes, {
      replayStore,
      resolveProof: () => Promise.reject(new Error('Delegation not found')),
    }),
    /Delegation not found/
  )

  assert.equal(await replayStore.kv.has([inv.cid.toString()]), false)
  await from(inv.bytes, { replayStore })
})

replay('should reject a replay with a malleated ECDSA signature', async () => {
  const es = await ECDSASigner.generate('P-256')
  const { inv, from } = await setup(es)
  const replayStore = new KVReplayStore()

  await from(inv.bytes, { replayStore })
  await assert.rejects(from(malleate(inv), { replayStore }), {
    message: 'UCAN signature verification failed',
  })
})

replay(
  'should reject invocations without expiration when maxTtl is set',
  async () => {
    const { inv, from } = await setup(mocks.alice, { exp: null })

    await assert.rejects(from(inv.bytes, { maxTtl: 300 }), {
      message:
        'UCAN Invocation must expire within 300 seconds, but has no expiration',
    })
  }
)

replay('should reject invocations expiring after maxTtl', async () => {
  const { inv, from } = await setup(mocks.alice, {
    exp: nowInSeconds() + 3600,
  })

  await assert.rejects(
    from(inv.bytes, { maxTtl: 300 }),
    /must expire within 300 seconds/
  )
  await from(inv.bytes, { maxTtl: 3600 })
})

replay('KVReplayStore.checkAndSet is atomic for concurrent calls', async () => {
  const replayStore = new KVReplayStore()

  const results = await Promise.all(
    Array.from({ length: 10 }, () => replayStore.checkAndSet('key', null))
  )

  assert.equal(results.filter(Boolean).length, 1)
})

replay('KVReplayStore.checkAndSet forgets expired keys', async () => {
  const replayStore = new KVReplayStore()

  assert.equal(await replayStore.checkAndSet('key', nowInSeconds() - 1), true)
  assert.equal(await replayStore.checkAndSet('key', nowInSeconds() + 60), true)
  assert.equal(await replayStore.checkAndSet('key', nowInSeconds() + 60), false)
})
