import { assert, suite } from 'playwright-test/taps'
import {
  compilePolicy,
  parseSelector,
  select,
  validate,
} from '../src/policy.js'
import type { Policy } from '../src/types.js'
import { assertPolicy } from '../src/utils.js'
import fixtures from './fixtures/policy.json' with { type: 'json' }

const policy = suite('policy')

/**
 * Validate untyped args against an untyped policy. Most tests below use
 * selectors that the typed {@link Policy} helper can't express.
 */
function check(args: unknown, pol: unknown) {
  return validate(args, pol as Policy)
}

for (const fixture of fixtures.valid) {
  policy(`fixtures valid ${JSON.stringify(fixture.args)}`, () => {
    const args = fixture.args
    const policies = fixture.policies

    for (const policy of policies) {
      assertPolicy(policy)
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
      assertPolicy(policy)
      assert.equal(
        validate(args, policy as Policy<typeof args>),
        false,
        JSON.stringify(policy)
      )
    }
  })
}

// The `should support undefined` test (`['!=', '.b', undefined]`) was removed:
// `undefined` is not an IPLD value, so it can't be encoded in a delegation and
// `assertPolicy` rejects it. Missing keys resolve to `null` instead.
policy('undefined is not a valid policy value', () => {
  assert.throws(() => assertPolicy([['!=', '.b', undefined]]), /Invalid policy/)
  assert.throws(
    () => assertPolicy([['==', '.b', [undefined]]]),
    /Invalid policy/
  )
})

// #641 Selector parsing

policy('selector: rejects segments the old regex silently skipped', () => {
  assert.equal(check({ foo: 1 }, [['==', '.foo-bar', 1]]), false)
  assert.equal(check({ foo: 1 }, [['!=', '.foo-bar', 1]]), false)
  assert.throws(() => parseSelector('.foo-bar'), /Invalid selector/)
  assert.throws(() => assertPolicy([['==', '.foo-bar', 1]]), /Invalid policy/)
})

policy('selector: quoted keys', () => {
  assert.equal(check({ 'a-b': 1 }, [['==', '.["a-b"]', 1]]), true)
  assert.equal(check({ 'a-b': 1 }, [['!=', '.["a-b"]', 1]]), false)
  assert.equal(check({ 'a-b': 2 }, [['!=', '.["a-b"]', 1]]), true)
})

policy('selector: rejects ".."', () => {
  assert.equal(check({ a: 1 }, [['==', '..a', 1]]), false)
  assert.throws(() => parseSelector('..a'), /"\.\." is not allowed/)
  assert.throws(() => parseSelector('.a..b'), /"\.\." is not allowed/)
  assert.throws(() => parseSelector('..'), /"\.\." is not allowed/)
  assert.throws(() => parseSelector('...'), /"\.\." is not allowed/)
})

policy('selector: must start with "."', () => {
  assert.equal(check({ a: 1 }, [['==', 'a', { a: 1 }]]), false)
  assert.throws(() => parseSelector('a'), /must start with "."/)
  assert.throws(() => parseSelector(''), /must start with "."/)
  assert.throws(() => parseSelector('[0]'), /must start with "."/)
  assert.throws(() => parseSelector(' .a'), /must start with "."/)
})

policy('selector: non-ASCII keys need the quoted form', () => {
  assert.equal(check({ ほげ: 1 }, [['==', '.ほげ', 1]]), false)
  assert.throws(() => parseSelector('.ほげ'), /Invalid selector/)
  assert.equal(check({ ほげ: 1 }, [['==', '.["ほげ"]', 1]]), true)
})

policy('selector: unambiguous field names select the right key', () => {
  const args = {
    '.': 'dot',
    $_: 'dollar',
    '$_*': 'dollar-star',
    '1': 'one',
    'with "quote"': 'quote',
    '': 'empty',
    'a\\b': 'backslash',
  }
  assert.equal(check(args, [['==', '.["."]', 'dot']]), true)
  assert.equal(check(args, [['==', '.["$_*"]', 'dollar-star']]), true)
  assert.equal(check(args, [['==', '.["1"]', 'one']]), true)
  assert.equal(check(args, [['==', '.["with \\"quote\\""]', 'quote']]), true)
  assert.equal(check(args, [['==', '.[""]', 'empty']]), true)
  assert.equal(check(args, [['==', '.["a\\\\b"]', 'backslash']]), true)
  assert.equal(check(args, [['==', '.["\\u0031"]', 'one']]), true)
  // `["1"]` is a map key, `[1]` is a list index.
  assert.equal(check(args, [['==', '.[1]', 'one']]), false)
  // quoted keys also work without the leading dot after another segment
  assert.equal(check({ a: { 'b-c': 1 } }, [['==', '.a["b-c"]', 1]]), true)
  assert.equal(check({ a: { 'b-c': 1 } }, [['==', '.a.["b-c"]', 1]]), true)
})

policy('selector: repeated optionals collapse into one', () => {
  assert.deepEqual(parseSelector('.foo???'), [
    { kind: 'field', key: 'foo', optional: true, source: '.foo???' },
  ])
  assert.equal(check({ a: 1 }, [['==', '.foo???', null]]), true)
  assert.equal(check({ foo: 1 }, [['==', '.foo???', 1]]), true)
  assert.equal(check({ to: [] }, [['==', '.to[1]???', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.a???.b', null]]), false)
})

policy('selector: parses every supported form', () => {
  assert.deepEqual(parseSelector('.'), [
    { kind: 'identity', optional: false, source: '.' },
  ])
  assert.deepEqual(parseSelector('.?'), [
    { kind: 'identity', optional: true, source: '.?' },
  ])
  assert.deepEqual(parseSelector('.bar0_'), [
    { kind: 'field', key: 'bar0_', optional: false, source: '.bar0_' },
  ])
  assert.deepEqual(parseSelector('._'), [
    { kind: 'field', key: '_', optional: false, source: '._' },
  ])
  assert.deepEqual(parseSelector('.a.b'), [
    { kind: 'field', key: 'a', optional: false, source: '.a' },
    { kind: 'field', key: 'b', optional: false, source: '.b' },
  ])
  assert.deepEqual(parseSelector('.["nope"]?'), [
    { kind: 'field', key: 'nope', optional: true, source: '.["nope"]?' },
  ])
  assert.deepEqual(parseSelector('.[]'), [
    { kind: 'iterate', optional: false, source: '.[]' },
  ])
  assert.deepEqual(parseSelector('.to[0][-42]'), [
    { kind: 'field', key: 'to', optional: false, source: '.to' },
    { kind: 'index', index: 0, optional: false, source: '[0]' },
    { kind: 'index', index: -42, optional: false, source: '[-42]' },
  ])
  assert.deepEqual(
    parseSelector('.a[7:11][2:][:42][0:-2]').map((s) =>
      s.kind === 'slice' ? [s.start, s.end] : s.kind
    ),
    ['field', [7, 11], [2, undefined], [undefined, 42], [0, -2]]
  )
  assert.deepEqual(parseSelector('.foo.'), [
    { kind: 'field', key: 'foo', optional: false, source: '.foo' },
    { kind: 'identity', optional: false, source: '.' },
  ])
})

policy('selector: rejects invalid syntax', () => {
  const invalid = [
    '.[',
    '.[0',
    '.["a"',
    '.["a',
    '.["a"x]',
    '.[1.5]',
    '.[1e3]',
    '.[+1]',
    '.[ 1 ]',
    '.[a]',
    '.[:]',
    '.[1:2:3]',
    '.[--1]',
    '.[99999999999999999999]',
    '.["\\x"]', // invalid JSON escape
    '.["a\nb"]', // raw control character
    '.]',
    '.a]',
    '.a b',
    '.a.-',
    '.1',
    '.$',
    '.*',
    '.a?b',
    '?',
    '.a|.b',
    '.a,.b',
  ]
  for (const sel of invalid) {
    assert.throws(() => parseSelector(sel), /Invalid selector/, sel)
    assert.equal(check({ a: 1 }, [['==', sel, 1]]), false, sel)
    assert.equal(check({ a: 1 }, [['not', ['==', sel, 1]]]), false, sel)
    assert.throws(() => assertPolicy([['==', sel, 1]]), /Invalid policy/, sel)
  }
})

policy(
  'selector: fuzz, parse either throws or consumes every character',
  () => {
    // mulberry32, so failures are reproducible
    let seed = 0x5eed
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const alphabet = [
      '.',
      '.',
      '[',
      ']',
      '"',
      '\\',
      '?',
      ':',
      '-',
      '0',
      '7',
      'a',
      'Z',
      '_',
      ' ',
      'ほ',
      '*',
      '$',
      '\n',
    ]
    let parsed = 0
    for (let i = 0; i < 5000; i++) {
      const length = Math.floor(random() * 10)
      let sel = '.'
      for (let j = 0; j < length; j++) {
        sel += alphabet[Math.floor(random() * alphabet.length)]
      }
      let segments: ReturnType<typeof parseSelector>
      try {
        segments = parseSelector(sel)
      } catch (error) {
        assert.ok(error instanceof TypeError, sel)
        continue
      }
      parsed++
      assert.equal(segments.map((s) => s.source).join(''), sel, sel)
      // sources are non-empty and contiguous
      for (const segment of segments) {
        assert.ok(segment.source.length > 0, sel)
      }
    }
    assert.ok(parsed > 50, `only ${parsed} random selectors parsed`)
  }
)

// #644 Selector resolution

policy('resolve: spec selector table', () => {
  const args = {
    from: 'alice@example.com',
    to: ['bob@example.com', 'carol@not.example.com', 'dan@example.com'],
    cc: ['fraud@example.com'],
    title: 'Meeting Confirmation',
    body: "I'll see you on Tuesday",
  }
  assert.deepEqual(select(args, '.'), { ok: true, value: args })
  assert.deepEqual(select(args, '.title'), {
    ok: true,
    value: 'Meeting Confirmation',
  })
  assert.deepEqual(select(args, '.cc'), {
    ok: true,
    value: ['fraud@example.com'],
  })
  assert.deepEqual(select(args, '.to[1]'), {
    ok: true,
    value: 'carol@not.example.com',
  })
  assert.deepEqual(select(args, '.to[-1]'), {
    ok: true,
    value: 'dan@example.com',
  })
  assert.deepEqual(select(args, '.to[99]?'), { ok: true, value: null })
  assert.deepEqual(select(args, '.to[99]'), { ok: false })
  assert.deepEqual(select(args, '.to[-4]'), { ok: false })
  assert.deepEqual(select(args, '.to[1:]'), {
    ok: true,
    value: ['carol@not.example.com', 'dan@example.com'],
  })
  assert.deepEqual(select(args, '.to[0:-2]'), {
    ok: true,
    value: ['bob@example.com'],
  })
  assert.deepEqual(select(args, '.to[]'), { ok: true, value: args.to })
  assert.deepEqual(select({ a: { x: 1, y: 2 } }, '.a[]'), {
    ok: true,
    value: [1, 2],
  })
})

policy('resolve: optional operator', () => {
  assert.equal(check({ a: 1 }, [['==', '.foo?', null]]), true)
  assert.equal(check({ to: [1] }, [['==', '.to[99]?', null]]), true)
  assert.equal(check({ to: [1] }, [['==', '.to[99]', null]]), false)
  assert.equal(check({ a: 1 }, [['==', '.a[0]?', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.a[0:1]?', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.a[]?', null]]), true)
  assert.equal(check({ a: [1] }, [['==', '.a.b?', null]]), true)
})

policy('resolve: missing map keys resolve to null', () => {
  assert.deepEqual(select({ a: 1 }, '.missing'), { ok: true, value: null })
  assert.equal(check({ a: 1 }, [['==', '.missing', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.["missing"]', null]]), true)
  // nested selectors without an optional fail the predicate
  assert.deepEqual(select({ a: 1 }, '.missing.x'), { ok: false })
  assert.equal(check({ a: 1 }, [['==', '.missing.x', null]]), false)
  assert.equal(check({ a: 1 }, [['==', '.missing?.x', null]]), false)
  assert.equal(check({ a: 1 }, [['==', '.missing.x?', null]]), true)
  // null values behave like missing keys
  assert.equal(check({ a: null }, [['==', '.a.x', null]]), false)
  assert.equal(check({ a: null }, [['==', '.a.x?', null]]), true)
})

policy('resolve: returns early even if a later segment is optional', () => {
  assert.deepEqual(select({ a: 1 }, '.a.b.c?'), { ok: false })
  assert.equal(check({ a: 1 }, [['==', '.a.b.c?', null]]), false)
  assert.deepEqual(select({ a: [] }, '.a[0][0]?'), { ok: false })
})

policy('resolve: type mismatches fail', () => {
  assert.deepEqual(select({ a: [1] }, '.a.b'), { ok: false })
  assert.deepEqual(select({ a: 'str' }, '.a.b'), { ok: false })
  assert.deepEqual(select({ a: 'str' }, '.a[0]'), { ok: false })
  assert.deepEqual(select({ a: 'str' }, '.a[0:1]'), { ok: false })
  assert.deepEqual(select({ a: 'str' }, '.a[]'), { ok: false })
  assert.deepEqual(select({ a: { 0: 1 } }, '.a[0]'), { ok: false })
  assert.deepEqual(select({ a: 1 }, '.a[]'), { ok: false })
  assert.deepEqual(select(null, '.a'), { ok: false })
  assert.deepEqual(select(null, '.'), { ok: true, value: null })
})

policy('resolve: "!=" is "not =="', () => {
  const args = { a: 1, to: [1, 2], s: 'str' }
  const cases: [string, unknown][] = [
    ['.a', 1], // present key, equal
    ['.a', 2], // present key, not equal
    ['.missing', 1], // missing key
    ['.missing', null], // missing key
    ['.to[99]', 1], // out-of-range index
    ['.to[99]', null], // out-of-range index
    ['.s.x', 1], // type mismatch
    ['.s[0]', 's'], // type mismatch
    ['.missing.x', null], // nested missing
  ]
  for (const [sel, value] of cases) {
    const neq = check(args, [['!=', sel, value]])
    const notEq = check(args, [['not', ['==', sel, value]]])
    assert.equal(neq, notEq, `${sel} ${JSON.stringify(value)}`)
    assert.equal(neq, !check(args, [['==', sel, value]]), sel)
  }
  assert.equal(check({ a: 1 }, [['!=', '.missing', 1]]), true)
  assert.equal(check({ a: 1 }, [['not', ['==', '.missing', 1]]]), true)
})

policy('resolve: prototype keys are missing', () => {
  assert.equal(check({ a: 1 }, [['==', '.__proto__', {}]]), false)
  assert.equal(check({ a: 1 }, [['==', '.__proto__', null]]), true)
  assert.equal(check({ a: 1 }, [['!=', '.constructor', null]]), false)
  assert.equal(check({ a: 1 }, [['==', '.constructor', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.toString', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.hasOwnProperty', null]]), true)
  assert.equal(check({ a: 1 }, [['==', '.["__proto__"]', null]]), true)
  assert.equal(check({ a: [1] }, [['==', '.a.length', null]]), false)
  // own keys with those names are data
  const own = JSON.parse('{"__proto__": 1, "constructor": 2}')
  assert.equal(check(own, [['==', '.__proto__', 1]]), true)
  assert.equal(check(own, [['==', '.constructor', 2]]), true)
})

policy('resolve: bytes are selected as [u8]', () => {
  const bytes = new Uint8Array([0xd6, 0xa9, 0xc1, 0x8c, 0xf8, 0xc4])
  // spec example
  assert.equal(check(bytes, [['==', '.[3]', 140]]), true)
  assert.equal(check({ b: bytes }, [['==', '.b[3]', 140]]), true)
  assert.equal(check({ b: bytes }, [['==', '.b[-1]', 0xc4]]), true)
  assert.equal(check({ b: bytes }, [['==', '.b[6]', null]]), false)
  assert.equal(check({ b: bytes }, [['==', '.b[6]?', null]]), true)
  assert.equal(check({ b: bytes }, [['>', '.b[0]', 200]]), true)
  assert.equal(
    check({ b: bytes }, [['==', '.b[1:3]', new Uint8Array([0xa9, 0xc1])]]),
    true
  )
  assert.equal(check({ b: bytes }, [['==', '.b[]', bytes]]), true)
  assert.equal(check({ b: bytes }, [['==', '.b', bytes]]), true)
  assert.equal(check({ b: bytes }, [['==', '.b', [...bytes]]]), false)
  assert.equal(check({ b: bytes }, [['==', '.b.x', null]]), false)
})

// #642 Quantifiers

policy('quantifiers: nested quantifiers apply element-wise', () => {
  const pol = [
    [
      'all',
      '.newsletters',
      ['any', '.recipients', ['==', '.email', 'bob@example.com']],
    ],
  ]
  // the spec's shape: a map of newsletters
  assert.equal(
    check(
      {
        newsletters: {
          christmas: {
            recipients: [
              { email: 'bob@example.com' },
              { email: 'alice@example.com' },
            ],
          },
        },
      },
      pol
    ),
    true
  )
  // a list of newsletters
  assert.equal(
    check(
      {
        newsletters: [
          { recipients: [{ email: 'bob@example.com' }] },
          { recipients: [{ email: 'bob@example.com' }] },
        ],
      },
      pol
    ),
    true
  )
  // bob is missing from one newsletter
  assert.equal(
    check(
      {
        newsletters: {
          christmas: { recipients: [{ email: 'bob@example.com' }] },
          easter: { recipients: [{ email: 'alice@example.com' }] },
        },
      },
      pol
    ),
    false
  )
  // the flattened shape the old fixture used
  assert.equal(
    check(
      {
        newsletters: {
          recipients: [
            { email: 'bob@example.com' },
            { email: 'alice@example.com' },
          ],
        },
      },
      pol
    ),
    false
  )
  assert.equal(
    check({ x: [{ y: [1] }, { y: [2] }] }, [
      ['any', '.x', ['all', '.y', ['==', '.', 2]]],
    ]),
    true
  )
  assert.equal(
    check({ x: [{ y: [1] }, { y: [1, 2] }] }, [
      ['all', '.x', ['any', '.y', ['==', '.', 2]]],
    ]),
    false
  )
  // the outer `all` must not be dropped: 1 and 2 are not collections
  assert.equal(
    check({ a: [1, 2] }, [['all', '.a', ['any', '.', ['==', '.', 1]]]]),
    false
  )
  assert.equal(
    check({ a: [[1], [1, 2]] }, [['all', '.a', ['any', '.', ['==', '.', 1]]]]),
    true
  )
})

policy(
  'quantifiers: triple nesting evaluates element-wise at each level',
  () => {
    const pol = [
      [
        'all',
        '.orgs',
        ['any', '.teams', ['all', '.members', ['>=', '.age', 18]]],
      ],
    ]
    const adults = { members: [{ age: 20 }, { age: 30 }] }
    const minors = { members: [{ age: 20 }, { age: 10 }] }
    assert.equal(
      check({ orgs: [{ teams: [minors, adults] }, { teams: [adults] }] }, pol),
      true
    )
    assert.equal(
      check({ orgs: [{ teams: [minors, adults] }, { teams: [minors] }] }, pol),
      false
    )
    assert.equal(
      check(
        { orgs: { a: { teams: { x: adults } }, b: { teams: { y: minors } } } },
        pol
      ),
      false
    )
    assert.equal(
      check(
        { orgs: { a: { teams: { x: adults } }, b: { teams: { y: adults } } } },
        pol
      ),
      true
    )
  }
)

policy('quantifiers: empty collections are true', () => {
  for (const op of ['all', 'any']) {
    assert.equal(check({ a: [] }, [[op, '.a', ['==', '.', 1]]]), true, op)
    assert.equal(check({ a: {} }, [[op, '.a', ['==', '.', 1]]]), true, op)
  }
})

policy('quantifiers: non-collections are false', () => {
  for (const op of ['all', 'any']) {
    for (const value of [1, 'str', true, null, new Uint8Array([1])]) {
      assert.equal(
        check({ a: value }, [[op, '.a', ['not', ['==', '.', 0]]]]),
        false,
        `${op} ${String(value)}`
      )
    }
    // missing key
    assert.equal(check({}, [[op, '.a', ['not', ['==', '.', 0]]]]), false, op)
    // unresolvable selector
    assert.equal(
      check({ a: 1 }, [[op, '.a.b', ['not', ['==', '.', 0]]]]),
      false
    )
  }
})

policy('quantifiers: any over map values', () => {
  assert.equal(
    check({ m: { x: 1, y: 2 } }, [['any', '.m', ['==', '.', 2]]]),
    true
  )
  assert.equal(
    check({ m: { x: 1, y: 2 } }, [['all', '.m', ['==', '.', 2]]]),
    false
  )
  assert.equal(
    check({ m: { x: 1, y: 2 } }, [['all', '.m', ['>', '.', 0]]]),
    true
  )
})

// #645 like, numbers, structure

policy('like: wildcard matches newlines', () => {
  assert.equal(check({ s: 'a\nb' }, [['like', '.s', 'a*b']]), true)
  assert.equal(check({ s: 'a\r\n b' }, [['like', '.s', 'a*b']]), true)
  assert.equal(check({ s: 'line1\nline2' }, [['like', '.s', '*']]), true)
  assert.equal(check({ s: '\n' }, [['like', '.s', '*']]), true)
  assert.equal(check({ s: 'a\nb' }, [['like', '.s', 'a\nb']]), true)
  assert.equal(check({ s: 'a\nc' }, [['like', '.s', 'a*b']]), false)
})

policy('like: escapes', () => {
  // `\*` is a literal `*`
  assert.equal(check({ s: 'a*b' }, [['like', '.s', 'a\\*b']]), true)
  assert.equal(check({ s: 'axb' }, [['like', '.s', 'a\\*b']]), false)
  // a `\` not followed by `*` is a literal backslash, so `\\*` is `\` + `\*`
  assert.equal(check({ s: '\\*' }, [['like', '.s', '\\\\*']]), true)
  assert.equal(check({ s: '\\abc' }, [['like', '.s', '\\\\*']]), false)
  assert.equal(check({ s: '\\' }, [['like', '.s', '\\\\*']]), false)
  assert.equal(check({ s: 'a\\b' }, [['like', '.s', 'a\\b']]), true)
  assert.equal(check({ s: 'a\\' }, [['like', '.s', 'a\\']]), true)
  // regex metacharacters are literal
  assert.equal(check({ s: 'a.b' }, [['like', '.s', 'a.b']]), true)
  assert.equal(check({ s: 'axb' }, [['like', '.s', 'a.b']]), false)
  assert.equal(check({ s: 'a+(b)' }, [['like', '.s', 'a+(b)']]), true)
  assert.equal(check({ s: 'aab' }, [['like', '.s', 'a+b']]), false)
  // `?` is not a single character matcher
  assert.equal(check({ s: 'ab' }, [['like', '.s', 'a?']]), false)
  assert.equal(check({ s: 'a?' }, [['like', '.s', 'a?']]), true)
  // non-strings never match
  assert.equal(check({ s: 1 }, [['like', '.s', '*']]), false)
  assert.equal(check({ s: null }, [['like', '.s', '*']]), false)
  assert.equal(check({}, [['like', '.s', '*']]), false)
})

policy('numbers: bigint and number are the same type', () => {
  assert.equal(check({ n: 10n }, [['>', '.n', 1]]), true)
  assert.equal(check({ n: 10n }, [['<', '.n', 1]]), false)
  assert.equal(check({ n: 1n }, [['==', '.n', 1]]), true)
  assert.equal(check({ n: 1 }, [['==', '.n', 1n]]), true)
  assert.equal(check({ n: 1n }, [['!=', '.n', 1]]), false)
  assert.equal(
    check({ n: [1n, { x: 2n }] }, [['==', '.n', [1, { x: 2 }]]]),
    true
  )
  assert.equal(check({ n: 1n }, [['==', '.n', 1.5]]), false)
  assert.equal(check({ n: 1n }, [['>=', '.n', 1]]), true)
  assert.equal(check({ n: 1n }, [['<=', '.n', 1.0]]), true)
  assert.equal(check({ n: 1n }, [['<', '.n', 1.5]]), true)
  assert.equal(check({ n: 1n }, [['>', '.n', 0.5]]), true)
  assert.equal(check({ n: -1n }, [['<', '.n', -0.5]]), true)
  assert.equal(check({ n: -1n }, [['>', '.n', -1.5]]), true)
  assert.equal(check({ n: 11 }, [['>', '.n', 10n]]), true)
  assert.equal(check({ n: 10.5 }, [['>', '.n', 10n]]), true)
  assert.equal(check({ n: 9.5 }, [['>', '.n', 10n]]), false)
  // beyond Number.MAX_SAFE_INTEGER, no precision is lost
  const big = 2n ** 53n + 1n
  assert.equal(check({ n: big }, [['>', '.n', 2 ** 53]]), true)
  assert.equal(check({ n: big }, [['==', '.n', 2 ** 53]]), false)
  assert.equal(check({ n: 2n ** 64n }, [['>', '.n', 1e19]]), true)
  // non-numbers never compare
  for (const n of ['1', null, true, [1], { n: 1 }]) {
    assert.equal(check({ n }, [['>', '.n', 0]]), false, JSON.stringify(n))
    assert.equal(check({ n }, [['<', '.n', 2]]), false, JSON.stringify(n))
  }
  assert.equal(check({}, [['<', '.n', 2]]), false)
})

policy('equality: deep comparison', () => {
  assert.equal(
    check({ a: { x: [1, 'a'] } }, [['==', '.a', { x: [1, 'a'] }]]),
    true
  )
  assert.equal(check({ a: { x: 1 } }, [['==', '.a', { x: 1, y: null }]]), false)
  assert.equal(check({ a: { x: 1, y: null } }, [['==', '.a', { x: 1 }]]), false)
  assert.equal(check({ a: [1, 2] }, [['==', '.a', { 0: 1, 1: 2 }]]), false)
  assert.equal(check({ a: { 0: 1, 1: 2 } }, [['==', '.a', [1, 2]]]), false)
  assert.equal(check({ a: '1' }, [['==', '.a', 1]]), false)
  assert.equal(
    check({ a: new Uint8Array([1, 2]) }, [
      ['==', '.a', new Uint8Array([1, 2])],
    ]),
    true
  )
  assert.equal(
    check({ a: new Uint8Array([1, 2]) }, [
      ['==', '.a', new Uint8Array([1, 3])],
    ]),
    false
  )
})

policy('structure: assertPolicy accepts valid policies', () => {
  const valid = [
    [],
    [['==', '.', null]],
    [['==', '.a', { b: [1, 2n, 'x', true, null, new Uint8Array([1])] }]],
    [['!=', '.["a-b"]?', 1]],
    [['>', '.a', 1.5]],
    [['<=', '.a', 10n]],
    [['like', '.a', '*@example.com']],
    [['not', ['==', '.a', 1]]],
    [['and', []]],
    [
      [
        'or',
        [
          ['==', '.a', 1],
          ['any', '.b[]', ['==', '.', 1]],
        ],
      ],
    ],
    [['all', '.a[1:]', ['any', '.b', ['like', '.', '*']]]],
  ]
  for (const pol of valid) {
    assertPolicy(pol)
    compilePolicy(pol)
  }
})

policy('structure: assertPolicy and validate reject invalid policies', () => {
  const invalid: unknown[] = [
    [['bogus']],
    [['bogus', '.a', 1]],
    {},
    null,
    '[]',
    [null],
    ['==', '.a', 1], // a statement, not a policy
    [['==', '.a']], // wrong arity
    [['==', '.a', 1, 2]],
    [['==']],
    [['not']],
    [['not', ['==', '.a', 1], ['==', '.a', 1]]],
    [['and']],
    [['and', ['==', '.a', 1]]],
    [['and', [['bogus']]]],
    [['or', {}]],
    [['all', '.a']],
    [['like', '.a', 1]],
    [['like', '.a']],
    [['like', 'a', '*']],
    [['>', '.a', '1']],
    [['>', '.a', null]],
    [['>', '.a', Number.NaN]],
    [['>', '.a', Number.POSITIVE_INFINITY]],
    [['all', 'a', ['==', '.', 1]]], // bad selector
    [['any', '..a', ['==', '.', 1]]],
    [['all', '.a', ['==', 'b', 1]]], // bad nested selector
    [['==', 1, 1]],
  ]
  for (const pol of invalid) {
    const label = String(JSON.stringify(pol))
    assert.throws(() => assertPolicy(pol), /Invalid policy/, label)
    assert.throws(() => compilePolicy(pol), TypeError, label)
    assert.equal(check({ a: 1 }, pol), false, label)
  }
})

policy(
  'structure: an invalid statement fails the policy even when short-circuited',
  () => {
    assert.equal(check({ a: 1 }, [['or', [['==', '.a', 1], ['bogus']]]]), false)
    assert.equal(
      check({ a: 1 }, [['and', [['==', '.a', 2], ['bogus']]]]),
      false
    )
    assert.equal(check({ a: 1 }, [['not', ['bogus']]]), false)
    assert.equal(check({ a: [] }, [['all', '.a', ['bogus']]]), false)
  }
)
