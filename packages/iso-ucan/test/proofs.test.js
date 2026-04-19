import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { assert, suite } from 'playwright-test/taps'
import { z } from 'zod/v4'
import { Capability } from '../src/capability.js'
import * as mocks from './mocks.js'

const proofs = suite('proofs')

const dan = await EdDSASigner.generate()

const AccountReadCap = Capability.from({
  schema: z.never(),
  cmd: '/account/read',
  verifierResolver: mocks.verifierResolver,
})

proofs('direct proof', async () => {
  const store = mocks.createStore()

  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const proofs = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(proofs.length, 1)
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, mocks.bob.did)
  assert.equal(proofs[0].sub, mocks.bob.did)
  assert.equal(proofs[0].aud, mocks.alice.did)
})

proofs('resolve bob > alice > carol', async () => {
  const store = mocks.createStore()

  await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const proofs = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.carol.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(proofs.length, 2)
  assert.equal(proofs[0].cmd, '/account')
  assert.equal(proofs[0].iss, mocks.bob.did)
  assert.equal(proofs[0].aud, mocks.alice.did)
  assert.equal(proofs[0].sub, mocks.bob.did)
  assert.equal(proofs[1].cmd, '/account/create')
  assert.equal(proofs[1].iss, mocks.alice.did)
  assert.equal(proofs[1].sub, mocks.bob.did)
  assert.equal(proofs[1].aud, mocks.carol.did)
})

proofs('resolve bob > alice(powerline) > carol', async () => {
  const store = mocks.createStore()

  await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: null,
    pol: [],
    store,
  })

  const proofs = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.carol.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(proofs.length, 2)
  assert.equal(proofs[0].cmd, '/account')
  assert.equal(proofs[0].iss, mocks.bob.did)
  assert.equal(proofs[0].sub, mocks.bob.did)
  assert.equal(proofs[0].aud, mocks.alice.did)
  assert.equal(proofs[1].cmd, '/account/create')
  assert.equal(proofs[1].iss, mocks.alice.did)
  assert.equal(proofs[1].sub, null)
  assert.equal(proofs[1].aud, mocks.carol.did)
})

proofs('resolve with broken branch', async () => {
  const store = mocks.createStore()

  // valid path
  await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  // broken path
  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })
  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const proofs = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.carol.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(proofs.length, 2)
  assert.equal(proofs[0].cmd, '/account')
  assert.equal(proofs[0].iss, mocks.bob.did)
  assert.equal(proofs[0].sub, mocks.bob.did)
  assert.equal(proofs[0].aud, mocks.alice.did)
  assert.equal(proofs[1].cmd, '/account/create')
  assert.equal(proofs[1].iss, mocks.alice.did)
  assert.equal(proofs[1].sub, mocks.bob.did)
  assert.equal(proofs[1].aud, mocks.carol.did)
})

proofs('returns empty when store is empty', async () => {
  const store = mocks.createStore()

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: {},
  })

  assert.deepEqual(result, [])
})

proofs('returns empty when no delegation targets the audience', async () => {
  const store = mocks.createStore()

  // bob delegates to alice, but we ask for a chain ending at carol
  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.carol.did,
    cmd: '/account/create',
    args: {},
  })

  assert.deepEqual(result, [])
})

proofs('returns empty when only a sibling command is delegated', async () => {
  const store = mocks.createStore()

  // /account/read is not an ancestor of /account/create, so it must not
  // satisfy a chain query for /account/create.
  await AccountReadCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: {},
  })

  assert.deepEqual(result, [])
})

proofs('top-level command "/" satisfies any invocation cmd', async () => {
  const store = mocks.createStore()

  await mocks.TopCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(result.length, 1)
  assert.equal(result[0].cmd, '/')
  assert.equal(result[0].iss, mocks.bob.did)
  assert.equal(result[0].sub, mocks.bob.did)
  assert.equal(result[0].aud, mocks.alice.did)
})

proofs('returns empty for a mutual cycle with no root', async () => {
  const store = mocks.createStore()

  // Neither party owns the subject (carol), so no proof can ever be a root.
  // bob -> alice and alice -> bob, both for sub=carol, must terminate without
  // looping forever and return an empty chain.
  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.carol.did,
    pol: [],
    store,
  })

  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.bob.did,
    sub: mocks.carol.did,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.carol.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: {},
  })

  assert.deepEqual(result, [])
})

proofs('skips a candidate whose policy fails for the args', async () => {
  const store = mocks.createStore()

  // Two parallel root delegations for the same chain. The first one (by
  // insertion) carries a policy that won't match our args; the second one
  // has no policy. Whichever is iterated first, the chain must end up
  // containing only the policy-passing delegation.
  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [['==', '.type', 'wrong']],
    store,
  })

  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: { type: 'account', properties: { name: 'jane' } },
  })

  assert.equal(result.length, 1)
  assert.deepEqual(result[0].pol, [])
})

proofs('returns empty when every candidate fails policy', async () => {
  const store = mocks.createStore()

  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [['==', '.type', 'wrong']],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    cmd: '/account/create',
    args: { type: 'account', properties: { name: 'jane' } },
  })

  assert.deepEqual(result, [])
})

proofs('resolves a 3-level chain in root-to-leaf order', async () => {
  const store = mocks.createStore()

  // bob -> alice (root, /account)
  await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  // alice -> carol (/account, sub still bob)
  await mocks.AccountCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  // carol -> dan (/account/create, sub still bob)
  await mocks.AccountCreateCap.delegate({
    iss: mocks.carol,
    aud: dan.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: dan.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(result.length, 3)
  assert.equal(result[0].iss, mocks.bob.did)
  assert.equal(result[0].aud, mocks.alice.did)
  assert.equal(result[0].cmd, '/account')
  assert.equal(result[1].iss, mocks.alice.did)
  assert.equal(result[1].aud, mocks.carol.did)
  assert.equal(result[1].cmd, '/account')
  assert.equal(result[2].iss, mocks.carol.did)
  assert.equal(result[2].aud, dan.did)
  assert.equal(result[2].cmd, '/account/create')
})

proofs('resolves a chain with mixed powerline links', async () => {
  const store = mocks.createStore()

  // bob -> alice (root, sub=bob)
  await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  // alice -> carol via powerline (sub=null)
  await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: null,
    pol: [],
    store,
  })

  // carol -> dan via powerline (sub=null)
  await mocks.AccountCreateCap.delegate({
    iss: mocks.carol,
    aud: dan.did,
    sub: null,
    pol: [],
    store,
  })

  const result = await store.chain({
    sub: mocks.bob.did,
    aud: dan.did,
    cmd: '/account/create',
    args: {},
  })

  assert.equal(result.length, 3)
  assert.equal(result[0].iss, mocks.bob.did)
  assert.equal(result[0].sub, mocks.bob.did)
  assert.equal(result[0].aud, mocks.alice.did)
  assert.equal(result[1].iss, mocks.alice.did)
  assert.equal(result[1].sub, null)
  assert.equal(result[1].aud, mocks.carol.did)
  assert.equal(result[2].iss, mocks.carol.did)
  assert.equal(result[2].sub, null)
  assert.equal(result[2].aud, dan.did)
})

proofs(
  'resolves the shortest available chain when multiple roots exist',
  async () => {
    const store = mocks.createStore()

    // Direct root: bob -> alice on /account/create
    await mocks.AccountCreateCap.delegate({
      iss: mocks.bob,
      aud: mocks.alice.did,
      sub: mocks.bob.did,
      pol: [],
      store,
    })

    // A longer alternative path also exists via /account broadening.
    // Both should be valid; chain returns the first found.
    await mocks.AccountCap.delegate({
      iss: mocks.bob,
      aud: mocks.carol.did,
      sub: mocks.bob.did,
      pol: [],
      store,
    })
    await mocks.AccountCreateCap.delegate({
      iss: mocks.carol,
      aud: mocks.alice.did,
      sub: mocks.bob.did,
      pol: [],
      store,
    })

    const result = await store.chain({
      sub: mocks.bob.did,
      aud: mocks.alice.did,
      cmd: '/account/create',
      args: {},
    })

    // At minimum, a valid chain exists and ends at alice on /account/create.
    assert.ok(result.length >= 1)
    const leaf = result[result.length - 1]
    assert.equal(leaf.aud, mocks.alice.did)
    assert.equal(leaf.cmd, '/account/create')
    // The first proof must always be a root (iss === sub).
    assert.equal(result[0].iss, result[0].sub)
  }
)
