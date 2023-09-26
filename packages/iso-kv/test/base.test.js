import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { MemoryStorageAdapter } from '../src/adapters/memory.js'
import { baseTests } from './base.js'

const kv = new KV({
  store: new MemoryStorageAdapter(),
})

baseTests(kv, suite('Memory'))

// const test = suite('Misc')
