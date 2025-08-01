import { assert, suite } from 'playwright-test/taps'
import * as mocks from './mocks.js'

const proofs = suite('proofs')

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
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, mocks.alice.did)
  assert.equal(proofs[0].sub, mocks.bob.did)
  assert.equal(proofs[0].aud, mocks.carol.did)
  assert.equal(proofs[1].cmd, '/account')
  assert.equal(proofs[1].iss, mocks.bob.did)
  assert.equal(proofs[1].aud, mocks.alice.did)
  assert.equal(proofs[1].sub, mocks.bob.did)
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
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, mocks.alice.did)
  assert.equal(proofs[0].sub, null)
  assert.equal(proofs[0].aud, mocks.carol.did)
  assert.equal(proofs[1].cmd, '/account')
  assert.equal(proofs[1].iss, mocks.bob.did)
  assert.equal(proofs[1].sub, mocks.bob.did)
  assert.equal(proofs[1].aud, mocks.alice.did)
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
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, mocks.alice.did)
  assert.equal(proofs[0].sub, mocks.bob.did)
  assert.equal(proofs[0].aud, mocks.carol.did)
  assert.equal(proofs[1].cmd, '/account')
  assert.equal(proofs[1].iss, mocks.bob.did)
  assert.equal(proofs[1].sub, mocks.bob.did)
  assert.equal(proofs[1].aud, mocks.alice.did)
})
