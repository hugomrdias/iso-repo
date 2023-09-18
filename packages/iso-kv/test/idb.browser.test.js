import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { baseTests, baseSchema } from './base.js'

import * as idb from '../src/idb.js'
/** @type {KV<typeof baseSchema>} */
const kv = new KV({
  schema: baseSchema,
  ...idb,
})

baseTests(kv, suite('IDB'))
