import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { baseTests, baseSchema } from './base.js'
import * as local from '../src/localstorage.js'

/** @type {KV<typeof baseSchema>} */
const kv = new KV({
  schema: baseSchema,
  ...local,
})

baseTests(kv, suite('Local Storage'))
