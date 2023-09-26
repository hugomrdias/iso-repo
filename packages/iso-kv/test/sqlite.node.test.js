import { suite } from 'playwright-test/taps'
import { KV } from '../src/index.js'
import { baseTests } from './base.js'
import { SqliteDialect } from 'kysely'
import SQLite from 'better-sqlite3'
import { SqlStorageAdapter } from '../src/adapters/sql.js'

const kv = new KV({
  store: new SqlStorageAdapter({
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
