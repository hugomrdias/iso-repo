import QuickLRU from 'quick-lru'
import { MemoryDriver } from '../src/drivers/memory.js'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new MemoryDriver(),
})

baseTests('Memory', kv)

const lru = new KV({
  driver: new QuickLRU({ maxSize: 10 }),
})

baseTests('LRU', lru)
