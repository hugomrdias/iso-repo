import { suite } from 'playwright-test/taps'
import { WebStorageDriver } from '../src/drivers/web-storage.js'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new WebStorageDriver(localStorage),
})

baseTests(kv, suite('Web Storage'))
