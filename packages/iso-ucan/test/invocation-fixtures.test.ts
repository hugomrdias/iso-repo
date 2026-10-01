// Upstream vectors mix padded and unpadded base64, `base64` decodes both
import { base64 } from 'iso-base/rfc4648'
import { assert, suite } from 'playwright-test/taps'
import { Delegation } from '../src/delegation.js'
import { Invocation } from '../src/invocation.js'
import data from './fixtures/invocation.json' with { type: 'json' }
import * as mocks from './mocks.js'

const InvalidErrorMap: Record<string, string> = {
  'no proof': 'UCAN Invocation proofs are required',
  'missing proof':
    'Delegation not found: bafyreidyjy36xsnbklgotghkc2igi3ri4w3h5o7d6it3jkbexewc223zbe',
  'expired proof': 'UCAN expiration must be in the future.',
  'inactive proof': 'UCAN not valid yet',
  'proof principal alignment': 'UCAN Invocation principal alignment mismatch',
  'invocation principal alignment':
    'UCAN Invocation principal alignment mismatch',
  'proof subject alignment': 'UCAN Invocation subject alignment mismatch',
  'invocation subject alignment': 'UCAN Invocation subject alignment mismatch',
  'expired invocation': 'UCAN expiration must be in the future.',
  'invalid proof signature': 'UCAN signature verification failed',
  'invalid invocation signature': 'UCAN signature verification failed',
  'invalid powerline': 'UCAN Invocation root proof is not self-signed',
  'policy violation': 'UCAN Invocation invalid arguments, expected',
}

const inv = suite('invocation-fixtures')

for (const fixture of data.valid) {
  inv(`should validate ${fixture.name}`, async () => {
    const { proofs } = fixture
    for (const proof of proofs) {
      const delegation = await Delegation.fromString(proof['/'].bytes)
      await delegation.validate({
        verifierResolver: mocks.verifierResolver,
        now: fixture.time,
      })
      await mocks.defaultStore.add([delegation])
    }
    try {
      const invocation = await Invocation.from({
        bytes: base64.decode(fixture.invocation['/'].bytes),
        verifierResolver: mocks.verifierResolver,
        resolveProof: (cid) => mocks.defaultStore.resolveProof(cid),
        now: fixture.time,
      })
      assert.equal(invocation.envelope.version, data.version)
    } catch (error) {
      assert.fail((error as Error).message)
    }
  })
}

for (const fixture of data.invalid) {
  inv(`should fail to validate ${fixture.name}`, async () => {
    const store = mocks.createStore()
    await assert.rejects(
      async () => {
        const { bytes } = fixture.invocation['/']
        const { proofs } = fixture
        for (const proof of proofs) {
          const delegation = await Delegation.fromString(proof['/'].bytes)
          await delegation.validate({
            verifierResolver: mocks.verifierResolver,
            now: fixture.time,
          })
          store.add([delegation])
        }
        await Invocation.from({
          bytes: base64.decode(bytes),
          verifierResolver: mocks.verifierResolver,
          resolveProof: (cid) => store.resolveProof(cid),
          now: fixture.time,
        })
      },
      (err) => {
        const error = err as Error

        assert.ok(
          error.message.includes(InvalidErrorMap[fixture.name]),
          `${fixture.name} - ${error.message}`
        )
        return true
      }
    )
  })
}
