import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'
import { temporaryDirectory } from 'tempy'
import { FileStorageAdapter } from '../src/adapters/file.js'

const kv = new KV({
  store: new FileStorageAdapter({
    cwd: temporaryDirectory(),
  }),
})

baseTests(kv, suite('File'))
