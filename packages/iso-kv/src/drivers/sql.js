import { Kysely } from 'kysely'
import { parse, stringify } from '../json.js'

/**
 * @typedef {import('../types.js').DriverAsync} DriverAsync
 * @typedef {import('../types.js').KvKey} KvKey
 */

/**
 * @param {unknown} data
 */
export function serialize(data) {
  return stringify(data)
}

/**
 * @param {unknown} data
 */
export function deserialize(data) {
  if (data === undefined) {
    return
  }
  // @ts-expect-error
  return parse(data)
}

/**
 * @class
 * @implements {DriverAsync}
 */
export class SqlDriver {
  /** @type {import('kysely').CompiledQuery<unknown>} */
  #tableQuery

  #isInitialized = false

  /**
   * @param {import('kysely').KyselyConfig & { name: string}} config
   */
  constructor(config) {
    this.name = config.name
    this.db = /** @type {Kysely<import('../types.js').KVDatabase<any>>} */ (
      new Kysely(config)
    )

    this.#tableQuery = this.db.schema
      .createTable(this.name)
      .ifNotExists()
      .addColumn('key', 'varchar(255)', (col) => {
        return col.primaryKey().notNull()
      })
      .addColumn('value', 'text')
      .compile()

    this.#isInitialized = false
  }

  async #init() {
    if (this.#isInitialized) {
      return
    }

    await this.db.executeQuery(this.#tableQuery)
    this.#isInitialized = true
  }

  /**
   * @type {DriverAsync['set']}
   */
  async set(key, value) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db
      .insertInto(this.name)
      .values({
        key,
        value: serialize(value),
      })
      .onConflict((oc) =>
        oc.column('key').doUpdateSet({ value: serialize(value) })
      )

      // MySQL doesn't support ON CONFLICT
      //   .onDuplicateKeyUpdate({
      //     value: serialized,
      //   })
      .execute()

    return this
  }

  /**
   * @param {string} key
   */
  async get(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    const row = await this.db
      .selectFrom(this.name)
      .selectAll()
      .where('key', '=', key)
      .executeTakeFirst()

    return deserialize(row?.value)
  }

  /** @type {DriverAsync['delete']} */
  async delete(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db
      .deleteFrom(this.name)
      .where('key', '=', key)
      .executeTakeFirst()
  }

  /** @type {DriverAsync['has']} */
  async has(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    const row = await this.get(key)

    return row !== undefined
  }

  async clear() {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db.deleteFrom(this.name).execute()
  }

  /**
   * @template [Value=unknown]
   * @returns {AsyncIterableIterator<[string, Value]>}
   */
  async *[Symbol.asyncIterator]() {
    if (!this.#isInitialized) {
      await this.#init()
    }
    const data = await this.db
      .selectFrom(this.name)
      .orderBy('key')
      .selectAll()
      .execute()

    for (const { key, value } of data) {
      yield [key, deserialize(value)]
    }
  }
}
