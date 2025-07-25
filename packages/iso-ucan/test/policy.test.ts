import { assert, suite } from 'playwright-test/taps'
import { validate } from '../src/policy.js'
import type { Policy } from '../src/types.js'
// @ts-ignore
import fixtures from './fixtures/policy.json' with { type: 'json' }

const policy = suite('policy')

for (const fixture of fixtures.valid) {
  policy(`fixtures valid ${JSON.stringify(fixture.args)}`, () => {
    const args = fixture.args
    const policies = fixture.policies

    for (const policy of policies) {
      assert.ok(
        validate(args, policy as Policy<typeof args>),
        JSON.stringify(policy)
      )
    }
  })
}

for (const fixture of fixtures.invalid) {
  policy(`fixtures invalid ${JSON.stringify(fixture.args)}`, () => {
    const args = fixture.args
    const policies = fixture.policies

    for (const policy of policies) {
      assert.equal(
        validate(args, policy as Policy<typeof args>),
        false,
        JSON.stringify(policy)
      )
    }
  })
}

policy('should support undefined', () => {
  const args = {
    a: [1, 2, { b: 3 }],
    b: 1,
  }

  const inequality: Policy<typeof args> = [['!=', '.b', undefined]]

  assert.ok(validate(args, inequality))
})
