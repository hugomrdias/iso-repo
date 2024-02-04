import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { IdbDriver } from '../src/drivers/idb.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new IdbDriver(),
})

baseTests(kv, suite('IDB'))
