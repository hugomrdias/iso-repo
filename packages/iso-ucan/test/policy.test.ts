import { assert, suite } from 'playwright-test/taps'
import { validate } from '../src/policy.js'
import type { Policy } from '../src/types.js'

const policy = suite('policy')

policy('spec comparison', () => {
  const args = {
    a: [1, 2, { b: 3 }],
    b: 1,
  }

  const equality: Policy<typeof args> = [
    ['==', '.a', [1, 2, { b: 3 }]],
    ['==', '.b', 1],
    ['==', '.b', 1.0],
    ['==', '.b', 1.0],
  ]

  assert.ok(validate(args, equality))

  const inequality: Policy<typeof args> = [
    ['!=', '.b', 'ddd'],
    ['!=', '.b', null],
    ['!=', '.b', undefined],
    ['!=', '.b', 2],
    ['!=', '.b', { b: 3 }],
    ['!=', '.b', true],
    ['!=', '.b', false],
    ['not', ['==', '.b', 2]],
  ]

  assert.ok(validate(args, inequality))

  const lessThan: Policy<typeof args> = [
    ['<', '.b', 2],
    ['<', '.b', 2.0],
  ]

  assert.ok(validate(args, lessThan))

  const greaterThan: Policy<typeof args> = [
    ['>', '.b', 0],
    ['>', '.b', 0.0],
  ]

  assert.ok(validate(args, greaterThan))

  const lessThanOrEqual: Policy<typeof args> = [
    ['<=', '.b', 2],
    ['<=', '.b', 2.0],
  ]

  assert.ok(validate(args, lessThanOrEqual))

  const greaterThanOrEqual: Policy<typeof args> = [
    ['>=', '.b', 0],
    ['>=', '.b', 0.0],
  ]

  assert.ok(validate(args, greaterThanOrEqual))
})

policy('spec glob matching (like)', () => {
  const args = {
    a: 'Alice*, Bob, Carol.',
    b: 'Alice*, Bob, Dan, Erin, Carol.',
    c: 'Alice*, Bob  , Carol.',
    d: 'Alice*, Bob*, Carol.',
    fail1: 'Alice*, Bob, Carol',
    fail2: 'Alice*, Bob*, Carol!',
    fail3: 'Alice, Bob, Carol.',
    fail4: 'Alice Cooper, Bob, Carol.',
    fail5: ' Alice*, Bob, Carol. ',
  }

  const pattern = 'Alice\\*, Bob*, Carol.'

  const like: Policy<typeof args> = [
    ['like', '.a', pattern],
    ['like', '.b', pattern],
    ['like', '.c', pattern],
    ['like', '.d', pattern],
  ]

  assert.ok(validate(args, like))

  const notLike1: Policy<typeof args> = [['like', '.fail1', pattern]]

  assert.equal(validate(args, notLike1), false)

  const notLike2: Policy<typeof args> = [['like', '.fail2', pattern]]

  assert.equal(validate(args, notLike2), false)

  const notLike3: Policy<typeof args> = [['like', '.fail3', pattern]]

  assert.equal(validate(args, notLike3), false)

  const notLike4: Policy<typeof args> = [['like', '.fail4', pattern]]

  assert.equal(validate(args, notLike4), false)

  const notLike5: Policy<typeof args> = [['like', '.fail5', pattern]]

  assert.equal(validate(args, notLike5), false)
})

policy('spec and', () => {
  const args = {
    name: 'Katie',
    age: 35,
    nationalities: ['Canadian', 'South African'],
  }

  const andEmpty: Policy<typeof args> = [['and', []]]

  assert.ok(validate(args, andEmpty))

  const andOne: Policy<typeof args> = [['and', [['==', '.name', 'Katie']]]]

  assert.ok(validate(args, andOne))

  const andTwo: Policy<typeof args> = [
    [
      'and',
      [
        ['==', '.name', 'Katie'],
        ['==', '.age', 35],
      ],
    ],
  ]

  assert.ok(validate(args, andTwo))

  const andThree: Policy<typeof args> = [
    [
      'and',
      [
        ['==', '.name', 'Katie'],
        ['==', '.age', 35],
        ['==', '.nationalities', ['Canadian', 'South African']],
      ],
    ],
  ]

  assert.ok(validate(args, andThree))

  const andFour: Policy<typeof args> = [
    [
      'and',
      [
        ['==', '.name', 'Katie'],
        ['==', '.age', 35],
        ['==', '.nationalities', 'american'],
      ],
    ],
  ]

  assert.equal(validate(args, andFour), false)
})

policy('spec or', () => {
  const args = {
    name: 'Katie',
    age: 35,
    nationalities: ['Canadian', 'South African'],
  }

  const orEmpty: Policy<typeof args> = [['or', []]]

  assert.ok(validate(args, orEmpty))

  const orOne: Policy<typeof args> = [
    [
      'or',
      [
        ['==', '.name', 'Katie'],
        ['>', '.age', 45],
      ],
    ],
  ]

  assert.ok(validate(args, orOne))
})

policy('spec not', () => {
  const args = { name: 'Katie', nationalities: ['Canadian', 'South African'] }

  const not: Policy<typeof args> = [
    [
      'not',
      [
        'and',
        [
          ['==', '.name', 'Katie'],
          ['==', '.nationalities', ['American']], // ⬅️  false
        ],
      ],
    ],
  ]

  assert.ok(validate(args, not))
})

policy('spec quantification', () => {
  const args = { a: [{ b: 1 }, { b: 2 }, { z: [7, 8, 9] }] }

  const fail: Policy<typeof args> = [['all', '.a', ['>', '.b', 0]]]

  assert.equal(validate(args, fail), false)

  const pass: Policy<typeof args> = [['any', '.a', ['==', '.b', 2]]]

  assert.equal(validate(args, pass), true)

  const data = {
    newsletters: {
      recipients: [
        { email: 'bob@example.com' },
        { email: 'alice@example.com' },
      ],
    },
  }

  const policy: Policy<typeof data> = [
    [
      'all',
      '.newsletters',
      ['any', '.recipients', ['==', '.email', 'bob@example.com']],
    ],
  ]

  assert.ok(validate(data, policy))
})

policy('spec example', () => {
  const args = {
    from: 'alice@example.com',
    to: ['bob@example.com', 'carol@not.example.com'],
    title: 'Coffee',
    body: 'Still on for coffee',
  }

  const delegationPolicy: Policy<typeof args> = [
    ['==', '.from', 'alice@example.com'],
    ['any', '.to', ['like', '.', '*@example.com']],
  ]

  assert.ok(validate(args, delegationPolicy))
})

policy('invalid example', () => {
  const args = {
    from: 'alice@example.com',
    to: ['carol@elsewhere.example.com'], // No match for `*@example.com`
    title: 'Coffee',
    body: 'Still on for coffee',
  }

  const delegationPolicy: Policy<typeof args> = [
    ['==', '.from', 'alice@example.com'],
    ['any', '.to', ['like', '.', '*@example.com']],
  ]

  assert.equal(validate(args, delegationPolicy), false)
})
