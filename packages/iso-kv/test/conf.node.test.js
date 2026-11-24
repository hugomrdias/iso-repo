import { temporaryDirectory } from 'tempy'
import { FileDriver } from '../src/drivers/file.js'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new FileDriver({
    cwd: temporaryDirectory(),
  }),
})

baseTests('File', kv)
