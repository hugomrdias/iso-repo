import { temporaryDirectory } from 'tempy'
import { z } from 'zod'
import { Conf } from '../src/index.js'
import type { SchemaKeyPath } from '../src/types.js'

declare function expectType<T>(value: T): void

const schema = z
  .object({
    foo: z.number().default(50),
    bar: z.string().optional(),
    nested: z.object({ value: z.boolean() }).optional(),
    items: z.array(z.object({ name: z.string() })).optional(),
  })
  .loose()

const config = new Conf({
  cwd: temporaryDirectory(),
  schema,
})

const foo = config.get('foo')
expectType<number>(foo)
// @ts-expect-error - foo is inferred as a number from the schema.
expectType<string>(foo)

const bar = config.get('bar')
expectType<string | undefined>(bar)

const nestedValue = config.get('nested.value')
expectType<boolean | undefined>(nestedValue)

expectType<SchemaKeyPath<typeof schema>>('foo')
expectType<SchemaKeyPath<typeof schema>>('nested')
expectType<SchemaKeyPath<typeof schema>>('nested.value')
expectType<Extract<Parameters<typeof config.has>[0], 'foo'>>('foo')
expectType<Extract<Parameters<typeof config.has>[0], 'nested.value'>>(
  'nested.value'
)

const barWithDefault = config.get('bar', 'fallback')
expectType<string>(barWithDefault)

expectType<unknown>(config.get('extra'))

config.set('foo', 1)
// @ts-expect-error - foo only accepts numbers.
config.set('foo', 'bad')

config.set('nested.value', true)
// @ts-expect-error - nested.value only accepts booleans.
config.set('nested.value', 'bad')

config.appendToArray('items', { name: 'value' })
// @ts-expect-error - items only accepts objects with a name.
config.appendToArray('items', { label: 'bad' })
// @ts-expect-error - foo is not an array.
config.appendToArray('foo', 1)

config.set({ foo: 1, bar: 'value' })
// @ts-expect-error - object setters use schema property types.
config.set({ foo: 'bad' })

config.set('extra', { custom: true })

config.onDidChange('foo', (newValue, oldValue) => {
  expectType<number | undefined>(newValue)
  expectType<number | undefined>(oldValue)
  // @ts-expect-error - foo change callbacks receive numbers.
  expectType<string>(newValue)
})

config.onDidChange('nested.value', (newValue, oldValue) => {
  expectType<boolean | undefined>(newValue)
  expectType<boolean | undefined>(oldValue)
})

config.onDidAnyChange((newValue, oldValue) => {
  expectType<z.infer<typeof schema>>(newValue)
  expectType<z.infer<typeof schema>>(oldValue)
})

const strictSchema = z.object({
  count: z.number(),
  names: z.array(z.string()).optional(),
  nested: z.object({ enabled: z.boolean() }),
})

const strictConfig = new Conf({
  cwd: temporaryDirectory(),
  schema: strictSchema,
})

expectType<z.infer<typeof strictSchema>>(strictConfig.store)
strictConfig.store = { count: 1, nested: { enabled: true } }
// @ts-expect-error - store assignment uses the full schema output.
strictConfig.store = { count: 'bad', nested: { enabled: true } }

expectType<SchemaKeyPath<typeof strictSchema>>('count')
expectType<SchemaKeyPath<typeof strictSchema>>('nested.enabled')
expectType<Extract<Parameters<typeof strictConfig.has>[0], 'count'>>('count')
expectType<Extract<Parameters<typeof strictConfig.has>[0], 'nested.enabled'>>(
  'nested.enabled'
)

const dynamicKey = 'custom' as string
strictConfig.get(dynamicKey)
strictConfig.set(dynamicKey, 'value')
strictConfig.has(dynamicKey)
strictConfig.delete(dynamicKey)
strictConfig.reset(dynamicKey)

for (const [key, value] of strictConfig) {
  expectType<'count' | 'names' | 'nested'>(key)
  expectType<number | string[] | { enabled: boolean } | undefined>(value)
}

const untyped = new Conf({
  cwd: temporaryDirectory(),
})

untyped.set('foo', 'value')
expectType<unknown>(untyped.get('foo'))
untyped.appendToArray('items', 'value')
untyped.onDidChange('foo', (newValue, oldValue) => {
  expectType<unknown>(newValue)
  expectType<unknown>(oldValue)
})
