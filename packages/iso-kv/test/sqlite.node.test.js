import { suite } from 'playwright-test/taps'
import { KV, serialize, deserialize } from '../src/index.js'
import { baseTests, baseSchema } from './base.js'
import { SqliteDialect } from 'kysely'
import SQLite from 'better-sqlite3'
import * as SQL from '../src/kysely.js'

/** @type {KV<typeof baseSchema>} */
const kv = new KV({
  schema: baseSchema,
  serialize,
  deserialize,
  store: new SQL.SqlStore({
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
