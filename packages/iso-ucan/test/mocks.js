import { MemoryDriver } from 'iso-kv/drivers/memory.js'
import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { verify } from 'iso-signatures/verifiers/eddsa.js'
import { Resolver } from 'iso-signatures/verifiers/resolver.js'
import { z } from 'zod'
import { Capability } from '../src/capability.js'
import { Store } from '../src/store.js'

export const carol = await EdDSASigner.import(
  'gCZC43QGw7ZvYQuKTtBwBy+tdjYrKf0hXU3dd+J0HON5dw=='
)
export const bob = await EdDSASigner.import(
  'gCZfj9+RzU2U518TMBNK/fjdGQz34sB4iKE6z+9lQDpCIQ=='
)
export const alice = await EdDSASigner.import(
  'gCa9UfZv+yI5/rvUIt21DaGI7EZJlzFO1uDc5AyJ30c6/w=='
)

export const verifierResolver = new Resolver({
  Ed25519: verify,
})

export const defaultStore = new Store(new MemoryDriver())

export function createStore() {
  return new Store(new MemoryDriver())
}

export const AccountCreateCap = Capability.from({
  schema: z.object({
    type: z.string(),
    properties: z
      .object({
        name: z.string(),
      })
      .strict(),
  }),
  cmd: '/account/create',
  verifierResolver,
})

export const AccountCap = Capability.from({
  schema: z.never(),
  cmd: '/account',
  verifierResolver,
})

export const TopCap = Capability.from({
  schema: z.never(),
  cmd: '/',
  verifierResolver,
})
