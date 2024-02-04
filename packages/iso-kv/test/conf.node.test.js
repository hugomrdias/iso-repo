import { suite } from 'playwright-test/taps'
import { temporaryDirectory } from 'tempy'
import { KV } from '../src/index.js'
import { FileDriver } from '../src/drivers/file.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new FileDriver({
    cwd: temporaryDirectory(),
  }),
})

baseTests(kv, suite('File'))
