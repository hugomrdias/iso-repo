import delay from 'delay'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import { Invocation } from '../src/invocation.js'
import { nowInSeconds } from '../src/utils.js'
import * as mocks from './mocks.js'

const inv = suite('invocation')

inv('should fail from wrong envelope', async () => {
  const delegation = await Delegation.create({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    cmd: '/account/create',
  })

  await mocks.defaultStore.add([delegation])

  await assert.rejects(
    Invocation.from({
      bytes: delegation.bytes,
      audience: mocks.alice,
      verifierResolver: mocks.verifierResolver,
      resolveProof: (cid) => mocks.defaultStore.resolveProof(cid),
    }),
    {
      name: 'TypeError',
      message: 'Invalid envelope type. Expected "inv" but got "dlg"',
    }
  )
})

inv('should fail from wrong audience', async () => {
  const store = mocks.createStore()
  const delegation = await Delegation.create({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    cmd: '/account/create',
  })

  await store.add([delegation])

  const inv = await mocks.AccountCreateCap.invoke({
    args: {
      type: 'account',
      properties: {
        name: 'John Doe',
      },
    },
    store,
    sub: mocks.bob.did,
    iss: mocks.alice,
  })

  await assert.rejects(
    Invocation.from({
      bytes: inv.bytes,
      audience: mocks.alice,
      verifierResolver: mocks.verifierResolver,
      resolveProof: (cid) => store.resolveProof(cid),
    }),
    /UCAN Invocation audience or subject does not match receiver/
  )
})

inv('should fail from expired delegation', async () => {
  const store = mocks.createStore()
  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
    exp: nowInSeconds(),
  })

  const inv = await mocks.AccountCreateCap.invoke({
    iss: mocks.alice,
    sub: mocks.bob.did,
    aud: mocks.bob.did,
    args: {
      type: 'account',
      properties: {
        name: 'John Doe',
      },
    },
    store,
  })
  await delay(1000)

  await assert.rejects(
    Invocation.from({
      bytes: inv.bytes,
      audience: mocks.bob,
      verifierResolver: mocks.verifierResolver,
      resolveProof: (cid) => store.resolveProof(cid),
    }),
    /Delegation not found/
  )
})

inv('should fail to invoke without proofs', async () => {
  const store = mocks.createStore()

  await assert.rejects(
    mocks.AccountCreateCap.invoke({
      iss: mocks.alice,
      sub: mocks.bob.did,
      aud: mocks.bob.did,
      args: {
        type: 'account',
        properties: {
          name: 'John Doe',
        },
      },
      store,
    }),
    /UCAN Invocation proofs are required/
  )
})

inv('should invoke self signed without proofs', async () => {
  const store = mocks.createStore()

  const inv = await mocks.AccountCreateCap.invoke({
    iss: mocks.alice,
    sub: mocks.alice.did,
    aud: mocks.bob.did,
    args: {
      type: 'account',
      properties: {
        name: 'John Doe',
      },
    },
    store,
  })
  assert.equal(inv.delegations.length, 0)
})

inv('should fail from invalid policy args', async () => {
  const store = mocks.createStore()
  await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [['==', '.type', 'account']],
    store,
  })

  await assert.rejects(
    mocks.AccountCreateCap.invoke({
      iss: mocks.alice,
      sub: mocks.bob.did,
      aud: mocks.bob.did,
      args: {
        type: 'accountss',
        properties: {
          name: 'John Doe',
        },
      },
      store,
    }),
    /UCAN Invocation proofs are required/
  )
})

inv('should fail from invalid policy args directly', async () => {
  const store = mocks.createStore()
  const dlg = await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [['==', '.type', 'account']],
    store,
    exp: nowInSeconds(),
  })

  await assert.rejects(
    Invocation.create({
      iss: mocks.alice,
      sub: mocks.bob.did,
      aud: mocks.bob.did,
      args: {
        type: 'accountss',
        properties: {
          name: 'John Doe',
        },
      },
      prf: [dlg],
      cmd: '/account/create',
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN Invocation invalid arguments/
  )
})
