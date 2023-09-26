import { suite } from 'playwright-test/taps'
import { temporaryDirectory } from 'tempy'
import { KV } from '../src/index.js'
import { FileStorageAdapter } from '../src/adapters/file.js'
import { baseTests } from './base.js'

const kv = new KV({
  store: new FileStorageAdapter({
    cwd: temporaryDirectory(),
  }),
})

baseTests(kv, suite('File'))
