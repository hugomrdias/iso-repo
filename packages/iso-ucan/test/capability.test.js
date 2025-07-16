import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { assert, suite } from 'playwright-test/taps'
import { z } from 'zod'
import { Capability } from '../src/capability.js'
import { Store } from '../src/store.js'

const test = suite('capability')

const owner = await EdDSASigner.generate()
const bob = await EdDSASigner.generate()
const invoker = await EdDSASigner.generate()

const store = new Store(new MemoryDriver())

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

test('encode', async () => {
  const nowInSeconds = Math.floor(Date.now() / 1000)

  const ownerDelegation = await AccountCap.delegate({
    iss: owner,
    aud: bob,
    sub: owner,
    pol: [],
    exp: nowInSeconds + 1000,
  })

  await store.set(ownerDelegation)

  const bobDelegation = await AccountCap.delegate({
    iss: bob,
    aud: invoker,
    sub: owner,
    pol: [],
    exp: nowInSeconds + 1000,
  })

  await store.set(bobDelegation)

  const invocation = await AccountCreateCap.invoke({
    iss: invoker,
    sub: owner,
    args: {
      type: 'account',
      properties: {
        name: 'John Doe',
      },
    },
    store,
    exp: nowInSeconds + 1000,
  })

  // console.log('🚀 ~ test.only ~ accountDelegation:', invocation)
})
