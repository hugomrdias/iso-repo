import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { baseTests, baseSchema } from './base.js'
import { temporaryDirectory } from 'tempy'
import Conf from 'conf'

/** @type {KV<typeof baseSchema>} */
const kv = new KV({
  schema: baseSchema,
  // @ts-ignore
  store: new Conf({
    cwd: temporaryDirectory(),
  }),
})

baseTests(kv, suite('Conf'))
