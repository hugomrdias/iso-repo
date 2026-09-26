import SQLite from 'better-sqlite3'
import { SqliteDialect } from 'kysely'
import { suite } from 'playwright-test/taps'
import { SqlDriver } from '../src/drivers/sql.js'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new SqlDriver({
    name: 'kv',
    dialect: new SqliteDialect({
      database: new SQLite(':memory:', {
        nativeBinding: `./node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`,
      }),
    }),
  }),
})

baseTests(kv, suite('SQL'))
