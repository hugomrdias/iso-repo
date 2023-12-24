import { assert, suite } from 'playwright-test/taps'
import { parse, stringify } from '../src/json.js'

const { test } = suite('json')

test('should support data types', async () => {
  let v
  assert.deepEqual(parse(stringify({ a: 1 })), { a: 1 })
  assert.deepEqual(parse(stringify([1n])), [1n])
  assert.deepEqual(parse(stringify({ a: { b: 1n } })), { a: { b: 1n } })

  v = new Map([['a', { b: 1n }]])
  assert.deepEqual(parse(stringify(v)), v)

  //   v = new Date()
  //   assert.deepEqual(parse(stringify(v)), v)

  v = new Set(['a', 1, new Set(['c', 'd'])])
  assert.deepEqual(parse(stringify(v)), v)

  v = /^[\s\w!,?àáâãçèéêíïñóôõöú-]+$/
  assert.deepEqual(parse(stringify(v)), v)
})
