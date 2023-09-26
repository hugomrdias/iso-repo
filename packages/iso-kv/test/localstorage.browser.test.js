import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { WebStorageAdapter } from '../src/adapters/web-storage.js'
import { baseTests } from './base.js'

const kv = new KV({
  store: new WebStorageAdapter(localStorage),
})

baseTests(kv, suite('Web Storage'))
