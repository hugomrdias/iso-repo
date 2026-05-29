import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { suite } from 'playwright-test/taps'
import { temporaryDirectory } from 'tempy'
import { z } from 'zod/v4'
import { Conf } from '../src/index.js'

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

/**
 * @param {Conf<typeof schema>} config
 * @returns {Conf<typeof schema>}
 */
function reloadConf(config) {
  return new Conf({
    projectName: 'iso-conf-test',
    cwd: pathFor(config),
    schema,
  })
}

jsonTest('persists extended types through Conf', () => {
  const config = createConf()
  const url = new URL('https://example.com/path')
  const map = new Map([['a', 1n]])
  const bytes = new Uint8Array([1, 2, 3])
  const arrayBuffer = new ArrayBuffer(3)
  new Uint8Array(arrayBuffer).set([7, 8, 9])
  const nodeBuffer = { type: 'Buffer', data: [4, 5, 6] }
  const tags = new Set([1, 2])
  const pattern = /foo/i

  config.set('website', url)
  config.set('mapping', map)
  config.set('bytes', bytes)
  config.set('arrayBuffer', arrayBuffer)
  config.set('nodeBuffer', nodeBuffer)
  config.set('big', 1n)
  config.set('tags', tags)
  config.set('pattern', pattern)

  const next = reloadConf(config)

  assert.equal(String(next.get('website')), 'https://example.com/path')
  assert.deepEqual(next.get('mapping'), map)
  assert.deepEqual(next.get('bytes'), bytes)
  assert.deepEqual(next.get('arrayBuffer'), new Uint8Array([7, 8, 9]))
  assert.deepEqual(next.get('nodeBuffer'), new Uint8Array([4, 5, 6]))
  assert.equal(next.get('big'), 1n)
  assert.deepEqual(next.get('tags'), tags)
  assert.deepEqual(next.get('pattern'), pattern)
})

jsonTest('persists nested extended types through Conf', () => {
  const config = createConf()
  const value = {
    nested: { big: 2n },
    tags: new Set(['a', 1, new Set(['c', 'd'])]),
    pattern: /^[\s\w!,?àáâãçèéêíïñóôõöú-]+$/,
  }

  config.set('extended', value)
  const next = reloadConf(config)

  assert.deepEqual(next.get('extended'), value)
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
