import { assert, suite } from 'playwright-test/taps'
import { validate } from '../src/policy.js'

const policy = suite('policy').only

policy('spec example', () => {
  const validInvocation = {
    cmd: '/msg/send',
    args: {
      from: 'alice@example.com',
      to: ['bob@example.com', 'carol@not.example.com'],
      title: 'Coffee',
      body: 'Still on for coffee',
    },
  }

  const delegationPolicy = [
    ['==', '.from', 'alice@example.com'],
    ['any', '.to', ['like', '.', '*@example.com']],
  ]

  assert.ok(validate(validInvocation.args, delegationPolicy))
})

policy('invalid example', () => {
  const invalidInvocation = {
    cmd: '/email/send',
    args: {
      from: 'alice@example.com',
      to: ['carol@elsewhere.example.com'], // No match for `*@example.com`
      title: 'Coffee',
      body: 'Still on for coffee',
    },
  }

  /** @type {import('../src/types.js').Policy} */
  const delegationPolicy = [
    ['==', '.from', 'alice@example.com'],
    ['any', '.to', ['like', '.', '*@example.com']],
  ]

  assert.equal(validate(invalidInvocation.args, delegationPolicy), false)
})
