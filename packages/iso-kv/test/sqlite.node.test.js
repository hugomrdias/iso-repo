import { suite } from 'playwright-test/taps'
import { SqliteDialect } from 'kysely'
import SQLite from 'better-sqlite3'
import { KV } from '../src/index.js'
import { SqlDriver } from '../src/drivers/sql.js'
import { baseTests } from './base.js'

const kv = new KV({
  driver: new SqlDriver({
    name: 'kv',
    dialect: new SqliteDialect({
      database: new SQLite(':memory:', {
        nativeBinding:
          './node_modules/better-sqlite3/build/Release/better_sqlite3.node',
      }),
    }),
  }),
})

baseTests(kv, suite('SQL'))
