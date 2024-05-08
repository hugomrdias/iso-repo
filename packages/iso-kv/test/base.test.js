import { suite } from 'playwright-test/taps'
import QuickLRU from 'quick-lru'
import { MemoryDriver } from '../src/drivers/memory.js'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new MemoryDriver(),
})

baseTests(kv, suite('Memory'))

const lru = new KV({
  driver: new QuickLRU({ maxSize: 10 }),
})

baseTests(lru, suite('LRU'))
