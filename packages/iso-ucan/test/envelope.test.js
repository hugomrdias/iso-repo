import { suite } from 'playwright-test/taps'
import * as mocks from './mocks.js'

const envelope = suite('envelope')

envelope('basic', async () => {
  const ownerDelegation = await mocks.AccountCreateCap.delegate({
    iss: mocks.bob,
    aud: mocks.carol.did,
    sub: mocks.bob.did,
    pol: [],
    store: mocks.defaultStore,
  })

  console.log(JSON.stringify(ownerDelegation.toJSON(), null, 2))
})
