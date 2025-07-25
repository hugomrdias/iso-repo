import { EdDSASigner } from 'iso-signatures/signers/eddsa.js'
import { suite } from 'playwright-test/taps'
import { z } from 'zod'
import { Capability } from '../src/capability.js'

const carol = await EdDSASigner.import(
  'gCZC43QGw7ZvYQuKTtBwBy+tdjYrKf0hXU3dd+J0HON5dw=='
)
const bob = await EdDSASigner.import(
  'gCZfj9+RzU2U518TMBNK/fjdGQz34sB4iKE6z+9lQDpCIQ=='
)
// const alice = await EdDSASigner.import(
//   'gCa9UfZv+yI5/rvUIt21DaGI7EZJlzFO1uDc5AyJ30c6/w=='
// )

const AccountCap = Capability.from({
  schema: z.never(),
  cmd: '/account',
})

const envelope = suite('envelope')

envelope('basic', async () => {
  const ownerDelegation = await AccountCap.delegate({
    iss: bob,
    aud: carol.did,
    sub: bob.did,
    pol: [],
  })

  console.log(JSON.stringify(ownerDelegation.toJSON(), null, 2))
})
