import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import envPaths from 'env-paths'
import { suite } from 'playwright-test/taps'
import { z } from 'zod'
import { Conf } from '../src/index.js'

/**
 * Importing `tempy` masks uncaught exceptions thrown from `EventTarget`
 * listeners, which would hide listener and watcher error regressions.
 */
function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'iso-conf-'))
}

const schema = z.looseObject({
  foo: z.number().min(1).max(100).default(50),
  bar: z.url().optional(),
  nested: z.object({ value: z.boolean() }).optional(),
  items: z.array(z.object({ name: z.string() })).optional(),
  newItems: z.array(z.unknown()).optional(),
})

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

test('flat keys for has, delete and appendToArray', () => {
  const config = createConf({ accessPropertiesByDotNotation: false })

  config.set('nested.value', true)
  assert.equal(config.has('nested.value'), true)
  assert.equal(config.has('nested'), false)

  config.appendToArray('list.items', 'a')
  config.appendToArray('list.items', 'b')
  assert.deepEqual(config.get('list.items'), ['a', 'b'])
  assert.equal(config.has('list'), false)

  config.delete('nested.value')
  assert.equal(config.has('nested.value'), false)
  assert.deepEqual({ ...config.store }, { foo: 50, 'list.items': ['a', 'b'] })
})

test('set object', () => {
  const config = createConf()
  config.set({ foo: 25 })
  assert.equal(config.get('foo'), 25)
})

test('set rejects keys that are not strings or objects', () => {
  const config = createConf()

  assert.throws(
    // @ts-expect-error - runtime validation should reject number keys.
    () => config.set(1, 'a'),
    {
      name: 'TypeError',
      message: 'Expected `key` to be of type `string` or `object`, got number',
    }
  )

  assert.throws(
    // @ts-expect-error - runtime validation should reject null keys.
    () => config.set(null),
    {
      name: 'TypeError',
      message: 'Expected `key` to be of type `string` or `object`, got null',
    }
  )

  assert.throws(
    // @ts-expect-error - runtime validation should reject array keys.
    () => config.set(['a', 'b']),
    {
      name: 'TypeError',
      message: 'Expected `key` to be of type `string` or `object`, got array',
    }
  )

  assert.equal(config.has('0'), false)
  assert.equal(config.has('1'), false)
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

test('fileExtension', () => {
  assert.equal(
    path.basename(createConf({ fileExtension: '.json' }).path),
    'config.json'
  )
  assert.equal(
    path.basename(createConf({ fileExtension: 'yaml' }).path),
    'config.yaml'
  )
  assert.equal(
    path.basename(createConf({ fileExtension: '.yaml' }).path),
    'config.yaml'
  )
  assert.equal(path.basename(createConf({ fileExtension: '' }).path), 'config')
  assert.equal(
    path.basename(createConf({ fileExtension: '...' }).path),
    'config'
  )
})

test('custom serialize and deserialize', () => {
  const cwd = temporaryDirectory()
  /** @type {import('../src/types.js').Serialize} */
  const serialize = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64')
  /** @type {import('../src/types.js').Deserialize} */
  const deserialize = (value) =>
    JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
  const options = {
    cwd,
    defaults: { bar: 'https://example.com' },
    serialize,
    deserialize,
  }

  const config = createConf(options)
  config.set('foo', 10)

  assert.deepEqual(deserialize(fs.readFileSync(config.path, 'utf8')), {
    foo: 10,
    bar: 'https://example.com',
  })
  assert.deepEqual(
    { ...createConf(options).store },
    { foo: 10, bar: 'https://example.com' }
  )
})

test('projectName resolves the config directory', () => {
  const config = new Conf({ projectName: `IsoConf Test ${process.pid}` })

  try {
    assert.equal(
      config.path,
      path.join(envPaths(`iso-conf-test-${process.pid}`).config, 'config.json')
    )
    assert.equal(fs.existsSync(path.dirname(config.path)), true)
  } finally {
    fs.rmSync(path.dirname(config.path), { recursive: true, force: true })
  }
})

test('throws without projectName or cwd', () => {
  assert.throws(() => new Conf(), {
    name: 'Error',
    message: 'Please specify the `projectName` option.',
  })
})

const schemaSuite = suite('Conf schema')
const { test: schemaTest } = schemaSuite

schemaTest('rejects invalid values', () => {
  const config = createConf()

  // @ts-expect-error - runtime validation should reject schema-invalid values.
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

schemaTest('persists schema defaults into an existing file', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(path.join(cwd, 'config.json'), JSON.stringify({}))

  const config = createConf({ cwd })
  assert.deepEqual(JSON.parse(fs.readFileSync(config.path, 'utf8')), {
    foo: 50,
  })
})

schemaTest('persists coerced values', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(path.join(cwd, 'config.json'), JSON.stringify({ foo: '7' }))

  const config = new Conf({
    cwd,
    schema: z.looseObject({ foo: z.coerce.number() }),
    defaults: { foo: 0 },
  })
  assert.deepEqual(JSON.parse(fs.readFileSync(config.path, 'utf8')), {
    foo: 7,
  })
})

schemaTest('does not rewrite an unchanged file', () => {
  const cwd = temporaryDirectory()
  const raw = JSON.stringify({ foo: 10, nested: { value: true } })
  fs.writeFileSync(path.join(cwd, 'config.json'), raw)

  const config = createConf({ cwd })
  assert.equal(fs.readFileSync(config.path, 'utf8'), raw)
})

schemaTest('reset restores defaults', () => {
  const config = createConf()
  config.set('foo', 99)
  config.reset('foo')
  assert.equal(config.get('foo'), 50)
})

schemaTest('reset restores nested defaults with dot notation', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    schema: z.looseObject({
      n: z.object({ v: z.number().default(7) }).default({ v: 7 }),
    }),
  })
  config.set('n.v', 1)
  config.reset('n.v')
  assert.equal(config.get('n.v'), 7)
})

schemaTest('reset leaves keys without a default unchanged', () => {
  const config = createConf()
  config.set('bar', 'https://example.com')
  config.reset('bar')
  assert.equal(config.get('bar'), 'https://example.com')
})

schemaTest('defaults apply after the file is deleted', () => {
  const config = createConf()
  fs.rmSync(config.path)
  assert.equal(config.get('foo'), 50)
})

schemaTest('rejects async schemas', () => {
  /** @type {import('@standard-schema/spec').StandardSchemaV1} */
  const asyncSchema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: async (value) => ({ value }),
    },
  }

  assert.throws(
    () => new Conf({ cwd: temporaryDirectory(), schema: asyncSchema }),
    {
      name: 'TypeError',
      message: /Async schemas are not supported/,
    }
  )
})

const requiredSchema = z.looseObject({
  req: z.number(),
  foo: z.number().default(50),
})

const requiredSuite = suite('Conf required fields')
const { test: requiredTest } = requiredSuite

requiredTest('throws on first run without defaults', () => {
  assert.throws(
    () =>
      // @ts-expect-error - `defaults` is required for this schema.
      new Conf({ cwd: temporaryDirectory(), schema: requiredSchema }),
    /Config schema violation: `req`/
  )
})

requiredTest('uses defaults on first run', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    schema: requiredSchema,
    defaults: { req: 1 },
  })
  assert.deepEqual(JSON.parse(fs.readFileSync(config.path, 'utf8')), {
    req: 1,
    foo: 50,
  })
})

requiredTest('fills new required fields in an existing file', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(path.join(cwd, 'config.json'), JSON.stringify({ foo: 3 }))
  const config = new Conf({ cwd, schema: requiredSchema, defaults: { req: 1 } })
  assert.equal(config.get('req'), 1)
  assert.equal(config.get('foo'), 3)
})

requiredTest('throws after the file is deleted without defaults', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(path.join(cwd, 'config.json'), JSON.stringify({ req: 1 }))
  // @ts-expect-error - `defaults` is required for this schema.
  const config = new Conf({ cwd, schema: requiredSchema })

  fs.rmSync(config.path)
  assert.throws(() => config.get('req'), /Config schema violation: `req`/)
})

requiredTest('defaults apply after the file is deleted or cleared', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    schema: requiredSchema,
    defaults: { req: 1 },
    clearInvalidConfig: true,
  })
  config.set({ req: 2, foo: 3 })

  fs.rmSync(config.path)
  assert.deepEqual({ ...config.store }, { req: 1, foo: 50 })

  fs.writeFileSync(config.path, '{invalid')
  assert.deepEqual({ ...config.store }, { req: 1, foo: 50 })

  fs.writeFileSync(config.path, JSON.stringify({ req: 'bad' }))
  assert.deepEqual({ ...config.store }, { req: 1, foo: 50 })
})

requiredTest('reset and clear use defaults and schema defaults', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    schema: requiredSchema,
    defaults: { req: 1 },
  })
  config.set({ req: 2, foo: 3 })
  config.reset('req', 'foo')
  assert.deepEqual({ ...config.store }, { req: 1, foo: 50 })

  config.set({ req: 2, foo: 3, extra: true })
  config.clear()
  assert.deepEqual({ ...config.store }, { req: 1, foo: 50 })
})

requiredTest('reset works per key when other keys are required', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(path.join(cwd, 'config.json'), JSON.stringify({ req: 1 }))
  // @ts-expect-error - `defaults` is required for this schema.
  const config = new Conf({ cwd, schema: requiredSchema })
  config.set('foo', 1)
  config.reset('foo')
  assert.equal(config.get('foo'), 50)
  config.reset('req')
  assert.equal(config.get('req'), 1)
})

requiredTest('defaults work without a schema', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    defaults: { nested: { a: 1 } },
  })
  config.set('nested.a', 2)
  config.reset('nested.a')
  assert.deepEqual(config.get('nested'), { a: 1 })
  config.clear()
  assert.deepEqual({ ...config.store }, { nested: { a: 1 } })
})

const outputSuite = suite('Conf schema output')
const { test: outputTest } = outputSuite

outputTest('writes the validated output', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    schema: z.object({ a: z.number().default(1) }),
  })
  config.set('extra', 5)
  assert.equal(config.get('extra'), undefined)
  assert.deepEqual(JSON.parse(fs.readFileSync(config.path, 'utf8')), { a: 1 })
})

outputTest('rejects writes whose output is not valid input', () => {
  const config = new Conf({
    cwd: temporaryDirectory(),
    schema: z.looseObject({
      s: z
        .string()
        .transform((v) => v.length)
        .optional(),
    }),
  })
  // @ts-expect-error - `s` is typed as the transformed output.
  assert.throws(() => config.set('s', 'abc'), {
    name: 'TypeError',
    message: /Schema output must be valid schema input/,
  })
  assert.equal(config.get('s'), undefined)
  config.set('other', 1)
  assert.equal(config.get('other'), 1)
})

const jsonTest = suite('Conf json')

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

hooksTest('callback errors dispatch error events', async () => {
  const config = createConf()
  /** @type {unknown[]} */
  const errors = []
  /** @type {unknown[]} */
  const values = []
  const error = new Error('listener boom')

  config.events.addEventListener('error', (event) => {
    errors.push(/** @type {CustomEvent} */ (event).detail)
  })
  config.onDidChange('foo', () => {
    throw error
  })
  config.onDidChange('foo', (newValue) => values.push(newValue))

  config.set('foo', 10)
  config.set('foo', 20)
  await sleep(0)

  assert.deepEqual(errors, [error, error])
  assert.deepEqual(values, [10, 20])
})

hooksTest('onDidAnyChange callback errors dispatch error events', async () => {
  const config = createConf()
  /** @type {unknown[]} */
  const errors = []
  /** @type {unknown[]} */
  const values = []
  const error = new Error('any listener boom')

  config.events.addEventListener('error', (event) => {
    errors.push(/** @type {CustomEvent} */ (event).detail)
  })
  config.onDidAnyChange(() => {
    throw error
  })
  config.onDidAnyChange((newValue) => values.push(newValue.foo))

  config.set('foo', 10)
  await sleep(0)

  assert.deepEqual(errors, [error])
  assert.deepEqual(values, [10])
})

hooksTest(
  'callback errors without an error listener do not escape',
  async () => {
    const config = createConf()
    /** @type {unknown[]} */
    const values = []

    config.onDidChange('foo', () => {
      throw new Error('unobserved boom')
    })
    config.onDidAnyChange(() => {
      throw new Error('unobserved boom')
    })
    config.onDidChange('foo', (newValue) => values.push(newValue))

    config.set('foo', 10)
    await sleep(0)

    assert.deepEqual(values, [10])
    assert.equal(config.get('foo'), 10)
  }
)

const readsSuite = suite('Conf disk reads')
const { test: readsTest } = readsSuite

/**
 * Count config file reads from disk while running `fn`.
 *
 * @param {Conf<typeof schema>} config
 * @param {() => void} fn
 */
function countDiskReads(config, fn) {
  const readFileSync = fs.readFileSync
  let reads = 0

  fs.readFileSync = /** @type {typeof fs.readFileSync} */ (
    (/** @type {Parameters<typeof fs.readFileSync>} */ ...args) => {
      if (args[0] === config.path) {
        reads++
      }
      return readFileSync(...args)
    }
  )

  try {
    fn()
  } finally {
    fs.readFileSync = readFileSync
  }

  return reads
}

readsTest('appendToArray reads the store once', () => {
  for (const accessPropertiesByDotNotation of [true, false]) {
    const config = createConf({ accessPropertiesByDotNotation })
    config.set('items', [{ name: 'foo' }])

    const reads = countDiskReads(config, () => {
      config.appendToArray('items', { name: 'bar' })
    })

    assert.equal(reads, 1)
    assert.deepEqual(config.get('items'), [{ name: 'foo' }, { name: 'bar' }])
  }
})

readsTest('reset reads the store once for multiple keys', () => {
  const config = createConf()
  config.set('foo', 99)

  /** @type {unknown[]} */
  const changes = []
  config.onDidAnyChange((newValue) => changes.push(newValue.foo))

  const reads = countDiskReads(config, () => {
    config.reset('foo', 'foo')
  })

  assert.equal(reads, 2, 'one read for reset, one for listeners')
  assert.deepEqual(changes, [50])
})

readsTest('listeners share one disk read per change', () => {
  const config = createConf()

  /** @type {unknown[]} */
  const fooChanges = []
  /** @type {unknown[]} */
  const barChanges = []
  /** @type {unknown[]} */
  const anyChanges = []
  config.onDidChange('foo', (newValue, oldValue) =>
    fooChanges.push([newValue, oldValue])
  )
  config.onDidChange('bar', (newValue, oldValue) =>
    barChanges.push([newValue, oldValue])
  )
  config.onDidAnyChange((newValue) => anyChanges.push(newValue.foo))

  const reads = countDiskReads(config, () => {
    config.set('foo', 10)
  })

  assert.equal(reads, 2, 'one read for set, one for listeners')
  assert.deepEqual(fooChanges, [[10, 50]])
  assert.deepEqual(barChanges, [])
  assert.deepEqual(anyChanges, [10])
})

readsTest('listeners handle manually dispatched change events', () => {
  const config = createConf()

  /** @type {unknown[]} */
  const changes = []
  config.onDidChange('foo', (newValue) => changes.push(newValue))
  config.onDidAnyChange((newValue) => changes.push(newValue.foo))

  fs.writeFileSync(config.path, JSON.stringify({ foo: 7 }))
  const reads = countDiskReads(config, () => {
    config.events.dispatchEvent(new Event('change'))
  })

  assert.equal(reads, 1)
  assert.deepEqual(changes, [7, 7])
})

readsTest('each listener gets its own copy', () => {
  const config = createConf()

  /** @type {Array<{ newValue: unknown, oldValue: unknown }>} */
  const nestedChanges = []
  /** @type {unknown[]} */
  const anyNested = []
  /** @type {unknown[]} */
  const fooChanges = []

  config.onDidChange('nested', (newValue) => {
    if (newValue) {
      newValue.value = false
    }
  })
  config.onDidAnyChange((newValue) => {
    anyNested.push(structuredClone(newValue.nested))
    newValue.foo = 1
  })
  config.onDidChange('nested', (newValue, oldValue) => {
    nestedChanges.push({ newValue, oldValue })
  })
  config.onDidChange('foo', (newValue) => fooChanges.push(newValue))

  config.set('nested', { value: true })

  assert.deepEqual(anyNested, [{ value: true }])
  assert.deepEqual(nestedChanges, [
    { newValue: { value: true }, oldValue: undefined },
  ])
  assert.deepEqual(fooChanges, [])
  assert.deepEqual(config.get('nested'), { value: true })
  assert.equal(config.get('foo'), 50)
})

const invalidSuite = suite('Conf invalid config')
const { test: invalidTest } = invalidSuite

invalidTest('clearInvalidConfig on corrupt json', () => {
  const config = createConf({ clearInvalidConfig: true })
  fs.writeFileSync(config.path, '{invalid')
  assert.deepEqual({ ...config.store }, { foo: 50 })
})

invalidTest('clearInvalidConfig on schema violation', () => {
  const config = createConf({ clearInvalidConfig: true })
  fs.writeFileSync(config.path, JSON.stringify({ foo: 'bad' }))
  assert.deepEqual({ ...config.store }, { foo: 50 })
})

invalidTest('clearInvalidConfig on extended JSON reviver error', () => {
  const config = createConf({ clearInvalidConfig: true })
  fs.writeFileSync(config.path, JSON.stringify({ u: { $url: 'nope' } }))
  assert.deepEqual({ ...config.store }, { foo: 50 })
})

invalidTest('clearInvalidConfig on custom deserialize error', () => {
  class CustomError extends Error {}
  const config = createConf({
    clearInvalidConfig: true,
    deserialize: (value) => {
      if (value.includes('bad')) {
        throw new CustomError('bad config')
      }
      return JSON.parse(value)
    },
  })
  fs.writeFileSync(config.path, 'bad')
  assert.deepEqual({ ...config.store }, { foo: 50 })
})

invalidTest('clearInvalidConfig recovers on init', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(
    path.join(cwd, 'config.json'),
    JSON.stringify({ u: { $url: 'nope' } })
  )
  const config = createConf({ cwd, clearInvalidConfig: true })
  assert.equal(config.get('foo'), 50)
  assert.deepEqual(JSON.parse(fs.readFileSync(config.path, 'utf8')), {
    foo: 50,
  })
})

invalidTest('clearInvalidConfig rewrites a cleared file on init', () => {
  const cwd = temporaryDirectory()
  fs.writeFileSync(path.join(cwd, 'config.json'), '{invalid')
  const config = new Conf({
    cwd,
    schema: z.looseObject({ bar: z.string().optional() }),
    clearInvalidConfig: true,
  })
  assert.deepEqual(JSON.parse(fs.readFileSync(config.path, 'utf8')), {})
})

invalidTest('deserialize errors propagate without clearInvalidConfig', () => {
  const config = createConf()
  fs.writeFileSync(config.path, JSON.stringify({ u: { $url: 'nope' } }))
  assert.throws(() => config.store, TypeError)
})

invalidTest('clearInvalidConfig does not hide fs errors', () => {
  const config = createConf({ clearInvalidConfig: true })
  fs.rmSync(config.path)
  fs.mkdirSync(config.path)
  assert.throws(() => config.store, { code: 'EISDIR' })
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

writeTest('defaults config files to owner read-write', () => {
  const config = createConf()
  config.set('foo', 33)

  assert.equal(fs.statSync(config.path).mode & 0o777, 0o600)
})

writeTest('uses configFileMode when set', () => {
  const config = createConf({ configFileMode: 0o640 })
  config.set('foo', 33)

  assert.equal(fs.statSync(config.path).mode & 0o777, 0o640)
})

writeTest('leaves no temporary file behind', () => {
  const config = createConf()
  config.set('foo', 33)
  config.set('foo', 34)

  assert.deepEqual(fs.readdirSync(pathFor(config)), ['config.json'])
})

writeTest('removes the temporary file when the write fails', () => {
  const config = createConf()
  fs.rmSync(config.path)
  fs.mkdirSync(config.path)

  assert.throws(() => {
    config.store = { foo: 33 }
  })
  assert.deepEqual(fs.readdirSync(pathFor(config)), ['config.json'])
  assert.equal(fs.statSync(config.path).isDirectory(), true)
})

writeTest(
  'writes through a symlinked config file',
  () => {
    const directory = temporaryDirectory()
    const target = path.join(directory, 'target.json')
    fs.writeFileSync(target, '{}')
    fs.symlinkSync(target, path.join(directory, 'config.json'))

    const config = createConf({ cwd: directory })
    config.set('foo', 33)

    assert.equal(fs.lstatSync(config.path).isSymbolicLink(), true)
    assert.match(fs.readFileSync(target, 'utf8'), /"foo": 33/)
    assert.deepEqual(fs.readdirSync(directory).sort(), [
      'config.json',
      'target.json',
    ])
  }, // Creating symlinks on Windows needs Developer Mode or admin rights.
  { skip: process.platform === 'win32' }
)

writeTest('does not install process signal handlers', () => {
  const directory = temporaryDirectory()
  // Tests are bundled, so resolve the source from the package directory. The
  // test script runs from there, as its test file glob is relative too.
  const entry = pathToFileURL(path.resolve('src/index.js')).href
  const script = `
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit', 'beforeExit']
    const count = () => signals.map((s) => process.listenerCount(s))
    const before = count()
    const { Conf } = await import(${JSON.stringify(entry)})
    new Conf({ cwd: ${JSON.stringify(directory)} }).set('foo', 1)
    console.log(JSON.stringify({ before, after: count() }))
  `
  const output = execFileSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    { encoding: 'utf8' }
  )
  const { before, after } = JSON.parse(output)

  assert.deepEqual(after, before)
})

/**
 * Run `fn` with `fs[name]` replaced by `replacement`.
 *
 * @template {keyof typeof fs} Name
 * @param {Name} name
 * @param {(original: (typeof fs)[Name]) => (typeof fs)[Name]} replacement
 * @param {() => void} fn
 */
function withFsStub(name, replacement, fn) {
  const original = fs[name]
  fs[name] = replacement(original)
  try {
    fn()
  } finally {
    fs[name] = original
  }
}

/**
 * @param {string} code
 */
function errnoError(code) {
  return Object.assign(new Error(code), { code })
}

writeTest('ignores chmod on file systems without permissions', () => {
  const config = createConf()

  withFsStub(
    'fchmodSync',
    () => () => {
      throw errnoError('ENOSYS')
    },
    () => config.set('foo', 33)
  )

  assert.equal(config.get('foo'), 33)
})

writeTest('retries a rename that fails with EBUSY', () => {
  const config = createConf()
  let calls = 0

  withFsStub(
    'renameSync',
    (renameSync) => (from, to) => {
      calls++
      if (calls === 1) {
        throw errnoError('EBUSY')
      }
      renameSync(from, to)
    },
    () => config.set('foo', 33)
  )

  assert.equal(calls, 2)
  assert.equal(config.get('foo'), 33)
  assert.deepEqual(fs.readdirSync(pathFor(config)), ['config.json'])
})

writeTest('throws the write error when cleanup also fails', () => {
  const config = createConf()

  withFsStub(
    'renameSync',
    () => () => {
      throw errnoError('EIO')
    },
    () =>
      withFsStub(
        'rmSync',
        () => () => {
          throw errnoError('EPERM')
        },
        () => assert.throws(() => config.set('foo', 33), { code: 'EIO' })
      )
  )
})

writeTest('writes files with long names', () => {
  const config = createConf({ configName: 'c'.repeat(250) })
  config.set('foo', 33)

  assert.equal(config.get('foo'), 33)
  assert.deepEqual(fs.readdirSync(pathFor(config)), [`${'c'.repeat(250)}.json`])
})

writeTest('removes stale temporary files from dead processes', () => {
  const directory = temporaryDirectory()
  const old = new Date(Date.now() - 120_000)
  const stale = 'config.json.999999999.deadbeef.tmp'
  const fresh = 'config.json.999999999.cafebabe.tmp'
  const own = `config.json.${process.pid}.0badf00d.tmp`
  const other = 'other.json.999999999.deadbeef.tmp'

  for (const name of [stale, fresh, own, other]) {
    fs.writeFileSync(path.join(directory, name), '{}')
  }

  for (const name of [stale, own, other]) {
    fs.utimesSync(path.join(directory, name), old, old)
  }

  createConf({ cwd: directory }).set('foo', 33)

  assert.deepEqual(
    fs.readdirSync(directory).sort(),
    ['config.json', fresh, own, other].sort()
  )
})

const watchSuite = suite('Conf watch')
const { test: watchTest } = watchSuite

/**
 * Run `fn` with `fs.watch` replaced by a fake watcher on the `fs.watch` code
 * path, so tests are deterministic on every platform.
 *
 * @param {(fake: { watcher: EventEmitter & { closed: boolean }, emitChange: () => void }) => Promise<void>} fn
 */
async function withFakeWatcher(fn) {
  const watch = fs.watch
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  const watcher = Object.assign(new EventEmitter(), {
    closed: false,
    close() {
      watcher.closed = true
    },
  })
  /** @type {((eventType: string, filename: string) => void) | undefined} */
  let listener

  fs.watch = /** @type {typeof fs.watch} */ (
    /** @type {unknown} */ (
      (
        /** @type {string} */ _directory,
        /** @type {object} */ _options,
        /** @type {typeof listener} */ callback
      ) => {
        listener = callback
        return watcher
      }
    )
  )
  Object.defineProperty(process, 'platform', { value: 'darwin' })

  try {
    await fn({
      watcher,
      emitChange: () => listener?.('change', 'config.json'),
    })
  } finally {
    fs.watch = watch
    if (platform) {
      Object.defineProperty(process, 'platform', platform)
    }
  }
}

watchTest('dispatches change after the debounce delay', async () => {
  await withFakeWatcher(async ({ emitChange }) => {
    const config = createConf({ watch: true })
    let changes = 0
    config.events.addEventListener('change', () => changes++)

    emitChange()
    emitChange()
    await sleep(150)
    config._closeWatcher()

    assert.equal(changes, 1)
  })
})

watchTest('_closeWatcher cancels a pending change', async () => {
  await withFakeWatcher(async ({ watcher, emitChange }) => {
    const config = createConf({ watch: true })
    let changes = 0
    config.events.addEventListener('change', () => changes++)

    emitChange()
    config._closeWatcher()
    await sleep(150)

    assert.equal(watcher.closed, true)
    assert.equal(changes, 0)
  })
})

watchTest('watcher errors close the watcher and dispatch error', async () => {
  await withFakeWatcher(async ({ watcher, emitChange }) => {
    const config = createConf({ watch: true })
    /** @type {unknown[]} */
    const errors = []
    let changes = 0
    config.events.addEventListener('error', (event) => {
      errors.push(/** @type {CustomEvent} */ (event).detail)
    })
    config.events.addEventListener('change', () => changes++)

    const error = new Error('EPERM')
    emitChange()
    watcher.emit('error', error)
    await sleep(150)

    assert.equal(watcher.closed, true)
    assert.deepEqual(errors, [error])
    assert.equal(changes, 0)
  })
})

watchTest(
  'watchFile triggers onDidChange and _closeWatcher unwatches',
  async () => {
    const { watchFile, unwatchFile } = fs
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    /** @type {(() => void) | undefined} */
    let listener
    /** @type {fs.PathLike[]} */
    const unwatched = []

    fs.watchFile = /** @type {typeof fs.watchFile} */ (
      /** @type {unknown} */ (
        (
          /** @type {fs.PathLike} */ _file,
          /** @type {object} */ _options,
          /** @type {() => void} */ callback
        ) => {
          listener = callback
        }
      )
    )
    fs.unwatchFile = /** @type {typeof fs.unwatchFile} */ (
      (/** @type {fs.PathLike} */ file) => {
        unwatched.push(file)
      }
    )
    Object.defineProperty(process, 'platform', { value: 'linux' })

    try {
      const config = createConf({ watch: true })
      /** @type {unknown[]} */
      const values = []
      config.onDidChange('foo', (newValue) => values.push(newValue))

      fs.writeFileSync(config.path, JSON.stringify({ foo: 10 }))
      listener?.()
      await sleep(1100)
      config._closeWatcher()

      assert.deepEqual(values, [10])
      assert.deepEqual(unwatched, [config.path])
    } finally {
      fs.watchFile = watchFile
      fs.unwatchFile = unwatchFile
      if (platform) {
        Object.defineProperty(process, 'platform', platform)
      }
    }
  }
)

watchTest('invalid external writes dispatch a single error', async () => {
  await withFakeWatcher(async ({ emitChange }) => {
    const config = createConf({ watch: true })
    /** @type {unknown[]} */
    const errors = []
    /** @type {unknown[]} */
    const values = []
    config.events.addEventListener('error', (event) => {
      errors.push(/** @type {CustomEvent} */ (event).detail)
    })
    config.onDidChange('foo', (newValue) => values.push(newValue))
    config.onDidAnyChange((newValue) => values.push(newValue.foo))

    fs.writeFileSync(config.path, '{partial')
    emitChange()
    await sleep(150)

    assert.equal(errors.length, 1)
    assert.ok(errors[0] instanceof SyntaxError)
    assert.deepEqual(values, [])

    fs.writeFileSync(config.path, JSON.stringify({ foo: 10 }))
    emitChange()
    await sleep(150)
    config._closeWatcher()

    assert.equal(errors.length, 1)
    assert.deepEqual(values, [10, 10])
  })
})
