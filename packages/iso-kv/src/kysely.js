import { Kysely } from 'kysely'

/**
 * @typedef {import('../src/types.js').Store} Store
 * @typedef {import('../src/types.js').DefaultKey} DefaultKey
 */

/**
 * @class SqlStore
 * @implements {Store}
 */
export class SqlStore {
  /** @type {import('kysely').CompiledQuery<unknown>} */
  #tableQuery

  #isInitialized = false
  /**
   * @param {import('kysely').KyselyConfig & { name: string}} config
   */
  constructor(config) {
    this.name = config.name
    this.db = /** @type {Kysely<import('../src/types.js').KVDatabase<any>>} */ (
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
   *
   * @param {DefaultKey} key
   */
  async get(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    const row = await this.db
      .selectFrom(this.name)
      .selectAll()
      .where('key', '=', key.toString())
      .executeTakeFirst()

    return row?.value
  }

  /**
   *
   * @param {DefaultKey} key
   * @param {unknown} value
   */
  async set(key, value) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    if (typeof value !== 'string') {
      throw new TypeError('Value must be a string')
    }

    await this.db
      .insertInto(this.name)
      .values({
        key: key.toString(),
        value,
      })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
      //   .onDuplicateKeyUpdate({
      //     value: serialized,
      //   })
      .execute()

    return this
  }

  /**
   * @param {DefaultKey} key
   */
  async has(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    const row = await this.get(key)

    return row !== undefined
  }

  /**
   * @param {DefaultKey} key
   */
  async delete(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db
      .deleteFrom(this.name)
      .where('key', '=', key.toString())
      .executeTakeFirst()
  }

  async clear() {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db.deleteFrom(this.name).execute()
  }

  /**
   * @returns {AsyncIterableIterator<[import('./types.js').DefaultKey, any]>}
   */
  async *[Symbol.asyncIterator]() {
    const all = await this.db.selectFrom(this.name).selectAll().execute()
    for (const { key, value } of all) {
      yield [key.toString(), value]
    }
  }
}
