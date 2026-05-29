import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { suite } from 'playwright-test/taps'
import { temporaryDirectory } from 'tempy'
import { z } from 'zod/v4'
import { Conf } from '../src/index.js'
import { parse, stringify } from '../src/json.js'

const schema = z
  .object({
    foo: z.number().min(1).max(100).default(50),
    bar: z.url().optional(),
    nested: z.object({ value: z.boolean() }).optional(),
    items: z.array(z.object({ name: z.string() })).optional(),
    newItems: z.array(z.unknown()).optional(),
  })
  .passthrough()

/**
 * @param {import('../src/types.js').Options<typeof schema>} [options]
 */
function createConf(options = {}) {
  return new Conf({
    projectName: 'iso-conf-test',
    cwd: temporaryDirectory(),
    schema,
    ...options,
  })
}

/**
 * @param {Conf<typeof schema>} config
 */
function pathFor(config) {
  return path.dirname(config.path)
}

const { test } = suite('Conf basics')

test('get/set/has/delete/clear', () => {
  const config = createConf()

  config.set('foo', 10)
  assert.equal(config.get('foo'), 10)
  assert.equal(config.has('foo'), true)

  config.delete('foo')
  assert.equal(config.get('foo'), 50)
  assert.equal(config.has('foo'), true)

  config.set('foo', 20)
  config.clear()
  assert.equal(config.get('foo'), 50)
})

test('dot notation', () => {
  const config = createConf()

  config.set('nested.value', true)
  assert.deepEqual(config.get('nested'), { value: true })

  const flat = createConf({ accessPropertiesByDotNotation: false })
  flat.set('nested.value', true)
  assert.equal(flat.get('nested.value'), true)
})

test('set object', () => {
  const config = createConf()
  config.set({ foo: 25 })
  assert.equal(config.get('foo'), 25)
})

test('appendToArray', () => {
  const config = createConf()
  config.set('items', [{ name: 'foo' }])
  config.appendToArray('items', { name: 'bar' })
  assert.deepEqual(config.get('items'), [{ name: 'foo' }, { name: 'bar' }])

  config.appendToArray('newItems', 'first')
  assert.deepEqual(config.get('newItems'), ['first'])
})

test('path and iteration', () => {
  const config = createConf()
  config.set('foo', 10)

  assert.ok(config.path.endsWith('config.json'))
  assert.equal(config.size, 1)

  const entries = [...config]
  assert.deepEqual(entries, [['foo', 10]])
})

const schemaSuite = suite('Conf schema')
const { test: schemaTest } = schemaSuite

schemaTest('rejects invalid values', () => {
  const config = createConf()

  assert.throws(() => config.set('foo', 'nope'), /Config schema violation/)
})

schemaTest('accepts valid values', () => {
  const config = createConf()
  config.set('foo', 42)
  config.set('bar', 'https://example.com')
  assert.equal(config.get('foo'), 42)
  assert.equal(config.get('bar'), 'https://example.com')
})

schemaTest('defaults from schema', () => {
  const config = createConf()
  assert.equal(config.get('foo'), 50)
})

schemaTest('reset restores defaults', () => {
  const config = createConf()
  config.set('foo', 99)
  config.reset('foo')
  assert.equal(config.get('foo'), 50)
})

const jsonSuite = suite('Conf json')
const { test: jsonTest } = jsonSuite

jsonTest('extended types round-trip', () => {
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

jsonTest('persists extended types in passthrough keys', () => {
  const config = createConf()
  const url = new URL('https://example.com')

  config.set('website', url)
  const next = new Conf({
    projectName: 'iso-conf-test',
    cwd: pathFor(config),
    schema,
  })

  assert.equal(String(next.get('website')), 'https://example.com/')
})

const hooksSuite = suite('Conf change hooks')
const { test: hooksTest } = hooksSuite

hooksTest('onDidChange', () => {
  const config = createConf()
  /** @type {Array<{ newValue: unknown, oldValue: unknown }>} */
  const values = []

  const unsubscribe = config.onDidChange('foo', (newValue, oldValue) => {
    values.push({ newValue, oldValue })
  })

  config.set('foo', 10)
  config.set('foo', 20)
  config.delete('foo')
  unsubscribe()
  config.set('foo', 30)

  assert.deepEqual(values, [
    { newValue: 10, oldValue: 50 },
    { newValue: 20, oldValue: 10 },
    { newValue: 50, oldValue: 20 },
  ])
})

hooksTest('onDidAnyChange', () => {
  const config = createConf()
  /** @type {Array<{ newValue: Record<string, unknown>, oldValue: Record<string, unknown> }>} */
  const snapshots = []

  const unsubscribe = config.onDidAnyChange((newValue, oldValue) => {
    snapshots.push({ newValue, oldValue })
  })

  config.set('foo', 10)
  unsubscribe()
  config.set('foo', 20)

  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0]?.newValue.foo, 10)
  assert.equal(snapshots[0]?.oldValue.foo, 50)
})

const invalidSuite = suite('Conf invalid config')
const { test: invalidTest } = invalidSuite

invalidTest('clearInvalidConfig on corrupt json', () => {
  const config = createConf({ clearInvalidConfig: true })
  fs.writeFileSync(config.path, '{invalid')
  assert.equal(Object.keys(config.store).length, 0)
})

invalidTest('clearInvalidConfig on schema violation', () => {
  const config = createConf({ clearInvalidConfig: true })
  fs.writeFileSync(config.path, JSON.stringify({ foo: 'bad' }))
  assert.equal(Object.keys(config.store).length, 0)
})

const writeSuite = suite('Conf atomic write')
const { test: writeTest } = writeSuite

writeTest('writes and reads back', () => {
  const config = createConf()
  config.set('foo', 33)

  const raw = fs.readFileSync(config.path, 'utf8')
  assert.match(raw, /"foo"/)

  const reloaded = new Conf({
    projectName: 'iso-conf-test',
    cwd: pathFor(config),
    schema,
  })
  assert.equal(reloaded.get('foo'), 33)
})
