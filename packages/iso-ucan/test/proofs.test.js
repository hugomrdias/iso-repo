import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { assert, suite } from 'playwright-test/taps'
import { z } from 'zod'
import { Capability } from '../src/capability.js'
import { Store } from '../src/store.js'

const owner = await EdDSASigner.generate()
const bob = await EdDSASigner.generate()
const alice = await EdDSASigner.generate()
const invoker = await EdDSASigner.generate()

const AccountCreateCap = Capability.from({
  schema: z.object({
    type: z.string(),
    properties: z
      .object({
        name: z.string(),
      })
      .strict(),
  }),
  cmd: '/account/create',
})

const AccountCap = Capability.from({
  schema: z.never(),
  cmd: '/account',
})

const TopCap = Capability.from({
  schema: z.never(),
  cmd: '/',
})

const proofs = suite('proofs')

proofs('direct proof', async () => {
  const store = new Store(new MemoryDriver())

  const ownerDelegation = await AccountCap.delegate({
    iss: owner,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
  })

  await store.add([ownerDelegation])

  const proofs = await store.chain({
    sub: owner.did,
    aud: invoker.did,
    cmd: '/account/create',
  })

  assert.equal(proofs.length, 1)
  assert.equal(proofs[0].cmd, '/account')
  assert.equal(proofs[0].iss, owner.did)
  assert.equal(proofs[0].sub, owner.did)
  assert.equal(proofs[0].aud, invoker.did)
})

proofs('resolve owner > bob > invoker', async () => {
  const store = new Store(new MemoryDriver())

  const ownerDelegation = await AccountCap.delegate({
    iss: owner,
    aud: bob.did,
    sub: owner.did,
    pol: [],
  })

  const bobDelegation = await AccountCreateCap.delegate({
    iss: bob,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
  })

  await store.add([bobDelegation, ownerDelegation])

  const proofs = await store.chain({
    sub: owner.did,
    aud: invoker.did,
    cmd: '/account/create',
  })

  assert.equal(proofs.length, 2)
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, bob.did)
  assert.equal(proofs[0].sub, owner.did)
  assert.equal(proofs[0].aud, invoker.did)
  assert.equal(proofs[1].cmd, '/account')
  assert.equal(proofs[1].iss, owner.did)
  assert.equal(proofs[1].sub, owner.did)
  assert.equal(proofs[1].aud, bob.did)
})

proofs('resolve owner > bob(powerline) > invoker', async () => {
  const store = new Store(new MemoryDriver())

  const ownerDelegation = await AccountCap.delegate({
    iss: owner,
    aud: bob.did,
    sub: owner.did,
    pol: [],
  })

  const bobDelegation = await AccountCreateCap.delegate({
    iss: bob,
    aud: invoker.did,
    sub: null,
    pol: [],
  })

  await store.add([bobDelegation, ownerDelegation])

  const proofs = await store.chain({
    sub: owner.did,
    aud: invoker.did,
    cmd: '/account/create',
  })

  assert.equal(proofs.length, 2)
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, bob.did)
  assert.equal(proofs[0].sub, null)
  assert.equal(proofs[0].aud, invoker.did)
  assert.equal(proofs[1].cmd, '/account')
  assert.equal(proofs[1].iss, owner.did)
  assert.equal(proofs[1].sub, owner.did)
  assert.equal(proofs[1].aud, bob.did)
})

proofs('resolve with broken branch', async () => {
  const store = new Store(new MemoryDriver())

  const ownerDelegation = await AccountCap.delegate({
    iss: owner,
    aud: bob.did,
    sub: owner.did,
    pol: [],
  })

  const bobDelegation = await AccountCreateCap.delegate({
    iss: bob,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
  })

  const ownerAliceDelegation = await TopCap.delegate({
    iss: invoker,
    aud: alice.did,
    sub: owner.did,
    pol: [],
  })
  const aliceDelegation = await AccountCreateCap.delegate({
    iss: alice,
    aud: invoker.did,
    sub: owner.did,
    pol: [],
  })

  await store.add([
    aliceDelegation,
    bobDelegation,
    ownerAliceDelegation,
    ownerDelegation,
  ])

  const proofs = await store.chain({
    sub: owner.did,
    aud: invoker.did,
    cmd: '/account/create',
  })

  assert.equal(proofs.length, 2)
  assert.equal(proofs[0].cmd, '/account/create')
  assert.equal(proofs[0].iss, bob.did)
  assert.equal(proofs[0].sub, owner.did)
  assert.equal(proofs[0].aud, invoker.did)
  assert.equal(proofs[1].cmd, '/account')
  assert.equal(proofs[1].iss, owner.did)
  assert.equal(proofs[1].sub, owner.did)
  assert.equal(proofs[1].aud, bob.did)
})
