import assert from 'node:assert/strict'
import { suite } from 'playwright-test/taps'
import { parse, stringify } from '../src/json.js'

const { test } = suite('json')

test('supports plain json values', () => {
  assert.deepEqual(parse(stringify({ a: 1 })), { a: 1 })
  assert.deepEqual(parse(stringify([1, 2, 3])), [1, 2, 3])
})

test('supports bigint', () => {
  assert.deepEqual(parse(stringify([1n])), [1n])
  assert.deepEqual(parse(stringify({ a: { b: 1n } })), { a: { b: 1n } })
})

test('supports map', () => {
  const value = new Map([['a', { b: 1n }]])
  assert.deepEqual(parse(stringify(value)), value)
})

test('supports set', () => {
  const value = new Set(['a', 1, new Set(['c', 'd'])])
  assert.deepEqual(parse(stringify(value)), value)
})

test('supports regexp', () => {
  const value = /^[\s\w!,?àáâãçèéêíïñóôõöú-]+$/
  assert.deepEqual(parse(stringify(value)), value)
})

test('supports url', () => {
  const value = new URL('https://example.com/path?query=1')
  assert.deepEqual(parse(stringify(value)), value)
})

test('supports uint8array', () => {
  const value = new Uint8Array([1, 2, 3])
  assert.deepEqual(parse(stringify(value)), value)
})

test('supports arraybuffer', () => {
  const value = new ArrayBuffer(3)
  new Uint8Array(value).set([1, 2, 3])
  assert.deepEqual(parse(stringify(value)), new Uint8Array([1, 2, 3]))
})

test('supports node buffer json shape', () => {
  const value = { type: 'Buffer', data: [4, 5, 6] }
  assert.deepEqual(parse(stringify(value)), new Uint8Array([4, 5, 6]))
})

test('supports extended types in one object', () => {
  const value = {
    url: new URL('https://example.com'),
    map: new Map([['a', 1n]]),
    bytes: new Uint8Array([1, 2, 3]),
    big: 1n,
    set: new Set([1, 2]),
    regex: /foo/i,
  }

  assert.deepEqual(parse(stringify(value)), value)
})
