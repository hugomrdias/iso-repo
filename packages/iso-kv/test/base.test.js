import { suite } from 'playwright-test/taps'
import QuickLRU from 'quick-lru'
import { KV } from '../src/index.js'
import { MemoryStorageAdapter } from '../src/adapters/memory.js'
import { baseTests } from './base.js'

const kv = new KV({
  store: new MemoryStorageAdapter(),
})

baseTests(kv, suite('Memory'))

const lru = new KV({
  store: new QuickLRU({ maxSize: 10 }),
})

baseTests(lru, suite('LRU'))
