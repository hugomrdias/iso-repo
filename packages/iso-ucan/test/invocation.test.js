import delay from 'delay'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import * as Envelope from '../src/envelope.js'
import { Invocation } from '../src/invocation.js'
import { commandCovers, nowInSeconds } from '../src/utils.js'
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
    sub: mocks.bob.did,
    iss: mocks.alice,
    args: {
      type: 'account',
      properties: {
        name: 'John Doe',
      },
    },
    store,
    verifierResolver: mocks.verifierResolver,
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
    verifierResolver: mocks.verifierResolver,
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
      verifierResolver: mocks.verifierResolver,
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
    verifierResolver: mocks.verifierResolver,
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
      verifierResolver: mocks.verifierResolver,
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

inv('should fail from root proof not self signed', async () => {
  const store = mocks.createStore()
  const dlg1 = await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.carol.did,
    pol: [],
    store,
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
      prf: [dlg1],
      cmd: '/account/create',
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN Invocation root proof is not self-signed/
  )
})

inv('should fail on principal alignment mismatch', async () => {
  const store = mocks.createStore()

  const dlg1 = await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const dlg2 = await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  await assert.rejects(
    Invocation.create({
      iss: mocks.carol,
      sub: mocks.bob.did,
      aud: mocks.alice.did,
      args: {
        type: 'account',
        properties: {
          name: 'John Doe',
        },
      },
      prf: [dlg1, dlg2],
      cmd: '/account/create',
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN Invocation principal alignment mismatch/
  )
})

inv('should fail on subject alignment mismatch', async () => {
  const store = mocks.createStore()

  const dlg1 = await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const dlg2 = await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.alice.did,
    pol: [],
    store,
  })

  await assert.rejects(
    Invocation.create({
      iss: mocks.carol,
      sub: mocks.bob.did,
      aud: mocks.alice.did,
      args: {
        type: 'account',
        properties: {
          name: 'John Doe',
        },
      },
      prf: [dlg1, dlg2],
      cmd: '/account/create',
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN Invocation subject alignment mismatch/
  )
})

inv('should fail on invocation command mismatch', async () => {
  const store = mocks.createStore()

  const dlg1 = await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const dlg2 = await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  await assert.rejects(
    Invocation.create({
      iss: mocks.carol,
      sub: mocks.bob.did,
      aud: mocks.alice.did,
      args: {
        type: 'account',
        properties: {
          name: 'John Doe',
        },
      },
      prf: [dlg1, dlg2],
      cmd: '/account',
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN Invocation command mismatch/
  )
})

inv('should fail on delegation command mismatch', async () => {
  const store = mocks.createStore()

  const dlg1 = await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const dlg2 = await mocks.AccountCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  await assert.rejects(
    Invocation.create({
      iss: mocks.carol,
      sub: mocks.bob.did,
      aud: mocks.alice.did,
      args: {
        type: 'account',
        properties: {
          name: 'John Doe',
        },
      },
      prf: [dlg1, dlg2],
      cmd: '/account',
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN Invocation command mismatch/
  )
})

inv('should create proofs in correct order from store', async () => {
  const store = mocks.createStore()

  const dlg1 = await mocks.AccountCap.delegate({
    iss: mocks.bob,
    aud: mocks.alice.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const dlg2 = await mocks.AccountCreateCap.delegate({
    iss: mocks.alice,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store,
  })

  const inv = await mocks.AccountCreateCap.invoke({
    verifierResolver: mocks.verifierResolver,
    iss: mocks.carol,
    sub: mocks.bob.did,
    aud: mocks.alice.did,
    args: {
      type: 'account',
      properties: {
        name: 'John Doe',
      },
    },
    store,
  })

  assert.equal(inv.delegations.length, 2)
  assert.equal(inv.delegations[0].cid.toString(), dlg1.cid.toString())
  assert.equal(inv.delegations[1].cid.toString(), dlg2.cid.toString())
})

inv('commandCovers should compare commands by segment', () => {
  assert.ok(commandCovers('/', '/'))
  assert.ok(commandCovers('/', '/crypto'))
  assert.ok(commandCovers('/', '/crypto/sign'))
  assert.ok(commandCovers('/crypto', '/crypto'))
  assert.ok(commandCovers('/crypto', '/crypto/sign'))
  assert.ok(commandCovers('/crypto', '/crypto/sign/ed25519'))

  assert.ok(!commandCovers('/crypto', '/cryptocurrency'))
  assert.ok(!commandCovers('/crypto', '/'))
  assert.ok(!commandCovers('/crypto', '/stack/pop'))
  assert.ok(!commandCovers('/crypto/sign', '/crypto'))
  assert.ok(!commandCovers('/flight/book', '/flight/bookkeeping'))
})

/**
 * Sign and encode an invocation without running the issuer-side proof checks,
 * like a malicious client would.
 *
 * @param {object} options
 * @param {import('../src/types.js').ISigner} options.iss
 * @param {import('../src/types.js').DID} options.sub
 * @param {string} options.cmd
 * @param {Delegation[]} options.prf
 */
async function forgeInvocation({ iss, sub, cmd, prf }) {
  const { signature, signaturePayload } = await Envelope.sign({
    spec: 'inv',
    signer: iss,
    payload: {
      iss: iss.toString(),
      aud: sub,
      sub,
      cmd,
      nonce: new Uint8Array(12),
      exp: nowInSeconds() + 60,
      args: {},
      prf: prf.map((p) => p.cid),
    },
  })
  return Envelope.encode({ signature, signaturePayload })
}

const invocationCmdCases = [
  { dlg: '/crypto', cmd: '/cryptocurrency', ok: false },
  { dlg: '/flight/book', cmd: '/flight/bookkeeping', ok: false },
  { dlg: '/account', cmd: '/accounts/delete', ok: false },
  { dlg: '/crypto/sign', cmd: '/crypto', ok: false },
  { dlg: '/crypto', cmd: '/crypto', ok: true },
  { dlg: '/crypto', cmd: '/crypto/sign', ok: true },
  { dlg: '/', cmd: '/cryptocurrency', ok: true },
]

for (const { dlg: dlgCmd, cmd, ok } of invocationCmdCases) {
  inv(
    `${dlgCmd} ${ok ? 'should' : 'should not'} prove invocation ${cmd}`,
    async () => {
      const store = mocks.createStore()
      const dlg = await Delegation.create({
        iss: mocks.bob,
        aud: mocks.alice.did,
        sub: mocks.bob.did,
        pol: [],
        cmd: dlgCmd,
      })
      await store.add([dlg])

      const create = () =>
        Invocation.create({
          iss: mocks.alice,
          sub: mocks.bob.did,
          cmd,
          args: {},
          prf: [dlg],
          verifierResolver: mocks.verifierResolver,
        })

      const bytes = await forgeInvocation({
        iss: mocks.alice,
        sub: mocks.bob.did,
        cmd,
        prf: [dlg],
      })
      const from = () =>
        Invocation.from({
          bytes,
          audience: mocks.bob,
          verifierResolver: mocks.verifierResolver,
          resolveProof: (cid) => store.resolveProof(cid),
        })

      if (ok) {
        await create()
        await from()
      } else {
        await assert.rejects(create, /UCAN Invocation command mismatch/)
        await assert.rejects(from, /UCAN Invocation command mismatch/)
      }
    }
  )
}

const delegationCmdCases = [
  { root: '/crypto', child: '/cryptocurrency', ok: false },
  { root: '/flight/book', child: '/flight/bookkeeping', ok: false },
  { root: '/crypto', child: '/crypto/sign', ok: true },
  { root: '/', child: '/cryptocurrency', ok: true },
]

for (const { root, child, ok } of delegationCmdCases) {
  inv(
    `delegation ${root} ${ok ? 'should' : 'should not'} prove delegation ${child}`,
    async () => {
      const store = mocks.createStore()
      const dlg1 = await Delegation.create({
        iss: mocks.bob,
        aud: mocks.alice.did,
        sub: mocks.bob.did,
        pol: [],
        cmd: root,
      })
      const dlg2 = await Delegation.create({
        iss: mocks.alice,
        aud: mocks.carol.did,
        sub: mocks.bob.did,
        pol: [],
        cmd: child,
      })
      await store.add([dlg1, dlg2])

      const create = () =>
        Invocation.create({
          iss: mocks.carol,
          sub: mocks.bob.did,
          cmd: child,
          args: {},
          prf: [dlg1, dlg2],
          verifierResolver: mocks.verifierResolver,
        })

      const bytes = await forgeInvocation({
        iss: mocks.carol,
        sub: mocks.bob.did,
        cmd: child,
        prf: [dlg1, dlg2],
      })
      const from = () =>
        Invocation.from({
          bytes,
          audience: mocks.bob,
          verifierResolver: mocks.verifierResolver,
          resolveProof: (cid) => store.resolveProof(cid),
        })

      if (ok) {
        await create()
        await from()
      } else {
        await assert.rejects(create, /UCAN Invocation command mismatch/)
        await assert.rejects(from, /UCAN Invocation command mismatch/)
      }
    }
  )
}
