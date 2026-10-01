import * as dagCbor from '@ipld/dag-cbor'
import delay from 'delay'
import { ECDSASigner } from 'iso-signatures/signers/ecdsa.js'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import * as Envelope from '../src/envelope.js'
import { Invocation } from '../src/invocation.js'
import {
  commandCovers,
  equivalentSignatures,
  nowInSeconds,
  signaturePayload,
} from '../src/utils.js'
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
    /UCAN Invocation audience does not match receiver/
  )
})

/**
 * @param {import('../src/types.js').ISigner<any>} iss
 * @param {import('../src/types.js').DID} sub
 */
async function aliceProofFrom(iss, sub) {
  const store = mocks.createStore()
  const dlg = await Delegation.create({
    iss,
    aud: mocks.alice.did,
    sub,
    pol: [],
    cmd: '/x',
  })
  await store.add([dlg])
  return { store, dlg }
}

inv('should omit aud when not set', async () => {
  const { store, dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.bob.did,
    cmd: '/x',
    args: {},
    prf: [dlg],
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal('aud' in invocation.payload, false)

  const decoded = await Invocation.from({
    bytes: invocation.bytes,
    audience: mocks.bob,
    verifierResolver: mocks.verifierResolver,
    resolveProof: (cid) => store.resolveProof(cid),
  })
  assert.equal('aud' in decoded.payload, false)
})

inv('should omit aud when it equals sub', async () => {
  const { dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.bob.did,
    aud: mocks.bob.did,
    cmd: '/x',
    args: {},
    prf: [dlg],
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal('aud' in invocation.payload, false)
})

inv('should fail when aud names a different executor', async () => {
  const { store, dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.bob.did,
    aud: mocks.carol.did,
    cmd: '/x',
    args: {},
    prf: [dlg],
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal(invocation.payload.aud, mocks.carol.did)

  await assert.rejects(
    Invocation.from({
      bytes: invocation.bytes,
      audience: mocks.bob,
      verifierResolver: mocks.verifierResolver,
      resolveProof: (cid) => store.resolveProof(cid),
    }),
    {
      name: 'TypeError',
      message: `UCAN Invocation audience does not match receiver. Expected: ${mocks.bob.did} but got: ${mocks.carol.did}`,
    }
  )
})

inv('should fail to decode when aud equals sub', async () => {
  const { store, dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const bytes = await forgeInvocation({
    iss: mocks.alice,
    sub: mocks.bob.did,
    aud: mocks.bob.did,
    cmd: '/x',
    prf: [dlg],
  })

  await assert.rejects(
    Invocation.from({
      bytes,
      audience: mocks.bob,
      verifierResolver: mocks.verifierResolver,
      resolveProof: (cid) => store.resolveProof(cid),
    }),
    {
      name: 'TypeError',
      message:
        'UCAN Invocation audience must be omitted when it equals the subject',
    }
  )
})

inv('should accept when aud is the receiver and sub differs', async () => {
  const { store, dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.bob.did,
    aud: mocks.carol.did,
    cmd: '/x',
    args: {},
    prf: [dlg],
    verifierResolver: mocks.verifierResolver,
  })

  const decoded = await Invocation.from({
    bytes: invocation.bytes,
    audience: mocks.carol,
    verifierResolver: mocks.verifierResolver,
    resolveProof: (cid) => store.resolveProof(cid),
  })
  assert.equal(decoded.payload.aud, mocks.carol.did)
})

inv('should create prf from the proof CIDs in order', async () => {
  const { dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.bob.did,
    cmd: '/x',
    args: {},
    prf: [dlg],
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal(invocation.payload.prf.length, 1)
  assert.ok(invocation.payload.prf[0].equals(dlg.cid))
})

inv('should fail when the resolver returns another delegation', async () => {
  const { dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const { dlg: other } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.bob.did,
    cmd: '/x',
    args: {},
    prf: [dlg],
    verifierResolver: mocks.verifierResolver,
  })

  await assert.rejects(
    Invocation.from({
      bytes: invocation.bytes,
      audience: mocks.bob,
      verifierResolver: mocks.verifierResolver,
      resolveProof: async () => other,
    }),
    {
      message: `UCAN Invocation proof CID mismatch, expected ${dlg.cid} but resolver returned ${other.cid}`,
    }
  )
})

inv('should fail when prf names a CID that is not the proof', async () => {
  const { dlg } = await aliceProofFrom(mocks.bob, mocks.bob.did)
  const unknown = CID.create(
    1,
    dagCbor.code,
    await sha256.digest(new Uint8Array([1]))
  )
  const bytes = await forgeInvocation({
    iss: mocks.alice,
    sub: mocks.bob.did,
    cmd: '/x',
    prf: [],
    fields: { prf: [unknown] },
  })

  await assert.rejects(
    Invocation.from({
      bytes,
      audience: mocks.bob,
      verifierResolver: mocks.verifierResolver,
      resolveProof: async () => dlg,
    }),
    /UCAN Invocation proof CID mismatch/
  )
})

inv(
  'should fail when the resolver returns a malleated ECDSA proof',
  async () => {
    const es256 = await ECDSASigner.generate('P-256')
    const { dlg } = await aliceProofFrom(es256, es256.did)
    const [, flipped] = equivalentSignatures('ES256', dlg.envelope.signature)
    const malleated = await Delegation.from({
      bytes: Envelope.encode({
        signature: flipped,
        // @ts-expect-error - signaturePayload returns a generic record
        signaturePayload: signaturePayload(dlg.envelope),
      }),
      verifierResolver: mocks.verifierResolver,
    })
    const invocation = await Invocation.create({
      iss: mocks.alice,
      sub: es256.did,
      cmd: '/x',
      args: {},
      prf: [dlg],
      verifierResolver: mocks.verifierResolver,
    })

    await assert.rejects(
      Invocation.from({
        bytes: invocation.bytes,
        verifierResolver: mocks.verifierResolver,
        resolveProof: async () => malleated,
      }),
      /UCAN Invocation proof CID mismatch/
    )
    await Invocation.from({
      bytes: invocation.bytes,
      verifierResolver: mocks.verifierResolver,
      resolveProof: async () => dlg,
    })
  }
)

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
 * @param {import('../src/types.js').DID} [options.aud]
 * @param {Record<string, unknown>} [options.fields] - Payload fields to set, `undefined` removes the field
 */
async function forgeInvocation({ iss, sub, cmd, prf, aud, fields = {} }) {
  /** @type {Record<string, unknown>} */
  const payload = {
    iss: iss.toString(),
    ...(aud && { aud }),
    sub,
    cmd,
    nonce: new Uint8Array(12),
    exp: nowInSeconds() + 60,
    args: {},
    prf: prf.map((p) => p.cid),
    ...fields,
  }
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) delete payload[key]
  }
  const { signature, signaturePayload } = await Envelope.sign({
    spec: 'inv',
    signer: iss,
    payload: /** @type {any} */ (payload),
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

/**
 * Decode a self-issued invocation from alice, forged with `fields`.
 *
 * @param {Record<string, unknown>} fields
 * @param {number} [now]
 */
async function fromSelfIssued(fields, now) {
  const bytes = await forgeInvocation({
    iss: mocks.alice,
    sub: mocks.alice.did,
    cmd: '/x',
    prf: [],
    fields,
  })
  return await Invocation.from({
    bytes,
    now,
    verifierResolver: mocks.verifierResolver,
    resolveProof: () => Promise.reject(new Error('no proofs expected')),
  })
}

inv('should check the invocation exp against now', async () => {
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.alice.did,
    cmd: '/x',
    args: {},
    prf: [],
    exp: 1000,
    now: 500,
    verifierResolver: mocks.verifierResolver,
  })
  /** @param {number} [now] */
  const from = (now) =>
    Invocation.from({
      bytes: invocation.bytes,
      now,
      verifierResolver: mocks.verifierResolver,
      resolveProof: () => Promise.reject(new Error('no proofs expected')),
    })

  await from(500)
  await from(1000)
  await assert.rejects(from(1001), {
    message:
      'UCAN expiration must be in the future. Received: 1000 but current time is 1001',
  })
  await assert.rejects(from(), /UCAN expiration must be in the future/)
  await assert.rejects(
    Invocation.create({
      iss: mocks.alice,
      sub: mocks.alice.did,
      cmd: '/x',
      args: {},
      prf: [],
      exp: 1000,
      now: 1001,
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN expiration must be in the future/
  )
})

inv(
  'should reject an invocation expired at now when the wall clock is earlier',
  async () => {
    const exp = nowInSeconds() + 60
    await fromSelfIssued({ exp })
    await assert.rejects(
      fromSelfIssued({ exp }, exp + 1),
      /UCAN expiration must be in the future/
    )
  }
)

inv('should omit empty meta', async () => {
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.alice.did,
    cmd: '/x',
    args: {},
    prf: [],
    meta: {},
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal('meta' in invocation.payload, false)

  const withMeta = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.alice.did,
    cmd: '/x',
    args: {},
    prf: [],
    meta: { a: 1 },
    verifierResolver: mocks.verifierResolver,
  })
  assert.deepEqual(withMeta.payload.meta, { a: 1 })
  await fromSelfIssued({ meta: { a: 1 } })
})

inv('should fail to decode empty or null meta', async () => {
  const message =
    'UCAN Invocation meta must be a non-empty map, omit it when empty'
  await assert.rejects(fromSelfIssued({ meta: {} }), {
    name: 'TypeError',
    message,
  })
  await assert.rejects(fromSelfIssued({ meta: null }), {
    name: 'TypeError',
    message,
  })
})

inv('should require prf on decode', async () => {
  const message = 'UCAN Invocation prf must be an array of CIDs'
  await assert.rejects(fromSelfIssued({ prf: undefined }), {
    name: 'TypeError',
    message,
  })
  await assert.rejects(fromSelfIssued({ prf: null }), {
    name: 'TypeError',
    message,
  })
  await assert.rejects(fromSelfIssued({ prf: ['bafy'] }), {
    name: 'TypeError',
    message,
  })

  const invocation = await fromSelfIssued({ prf: [] })
  assert.deepEqual(invocation.payload.prf, [])
})

inv('should validate iat as a safe integer', async () => {
  for (const iat of ['x', 1.5, 2 ** 53, null]) {
    await assert.rejects(
      fromSelfIssued({ iat }),
      {
        name: 'TypeError',
        message: `UCAN iat must be a safe integer. Received: ${iat}`,
      },
      `iat: ${iat}`
    )
  }
  await assert.rejects(
    Invocation.create({
      iss: mocks.alice,
      sub: mocks.alice.did,
      cmd: '/x',
      args: {},
      prf: [],
      iat: 1.5,
      verifierResolver: mocks.verifierResolver,
    }),
    /UCAN iat must be a safe integer/
  )

  const iat = nowInSeconds()
  const decoded = await fromSelfIssued({ iat })
  assert.equal(decoded.payload.iat, iat)

  const created = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.alice.did,
    cmd: '/x',
    args: {},
    prf: [],
    iat: 0,
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal(created.payload.iat, 0)
})

inv('should not emit nbf', async () => {
  const invocation = await Invocation.create({
    iss: mocks.alice,
    sub: mocks.alice.did,
    cmd: '/x',
    args: {},
    prf: [],
    // @ts-expect-error - nbf is not an invocation field
    nbf: nowInSeconds() + 1000,
    verifierResolver: mocks.verifierResolver,
  })
  assert.equal('nbf' in invocation.payload, false)
})

inv('should fail to decode nbf', async () => {
  await assert.rejects(fromSelfIssued({ nbf: nowInSeconds() }), {
    name: 'TypeError',
    message: 'UCAN Invocation must not have nbf',
  })
})
