/* eslint-disable no-continue */
import { Kysely } from 'kysely'

/* eslint-disable object-shorthand */
/**
 * @typedef {import('../types').KvStorageAdapter} KvStorageAdapter
 * @typedef {import('../types').KvKey} KvKey
 */

/**
 * @param {KvKey} key
 */
function encodeKey(key) {
  return key.join(':')
}

/**
 * @param {string} key
 */
function decodeKey(key) {
  return key.split(':')
}

/**
 * @param {unknown} data
 */
export function serialize(data) {
  return JSON.stringify(data)
}

/**
 * @param {unknown} data
 */
export function deserialize(data) {
  if (data === undefined) {
    return
  }
  // @ts-ignore
  return JSON.parse(data)
}

/**
 *
 * @param {unknown} key
 * @returns { KvKey}
 */
function asKey(key) {
  return /** @type {KvKey} */ (key)
}

/**
 * @class
 * @implements {KvStorageAdapter}
 */
export class SqlStorageAdapter {
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
   * @type {KvStorageAdapter['set']}
   */
  async set(key, value) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db
      .insertInto(this.name)
      .values({
        key: encodeKey(key),
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
   * @template [Value = unknown]
   * @param {KvKey} key
   */
  async get(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    const row = await this.db
      .selectFrom(this.name)
      .selectAll()
      .where('key', '=', encodeKey(key))
      .executeTakeFirst()

    return deserialize(row?.value)
  }

  /** @type {KvStorageAdapter['delete']} */
  async delete(key) {
    if (!this.#isInitialized) {
      await this.#init()
    }

    await this.db
      .deleteFrom(this.name)
      .where('key', '=', encodeKey(key))
      .executeTakeFirst()
  }

  /** @type {KvStorageAdapter['has']} */
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
   * @returns {AsyncIterableIterator<import('../types').KvEntry>}
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
      yield {
        key: decodeKey(key),
        value: deserialize(value),
      }
    }
  }

  /**
   * @template [Value = unknown]
   * @param {import('../types').KvListSelector} selector
   * @param {import('../types').KvListOptions} [options]
   * @returns {AsyncIterator<import('../types').KvEntry>}
   */
  async *list(selector, options = {}) {
    const { limit, reverse } = options

    let count = 0
    const data = []

    for await (const kv of this) {
      data.push(kv)
    }

    if (reverse) {
      data.reverse()
    }

    for (const { key, value } of data) {
      if (
        'start' in selector &&
        asKey(key).join(':').localeCompare(selector.start.join(':')) < 0
      ) {
        continue
      }

      if (
        'end' in selector &&
        asKey(key).join(':').localeCompare(selector.end.join(':')) >= 0
      ) {
        continue
      }

      if (
        'prefix' in selector &&
        !asKey(key)
          .join(':')
          .startsWith(selector.prefix.join(':') + ':')
      ) {
        continue
      }

      yield {
        key: asKey(key),
        value,
      }

      count++
      if (limit !== undefined && count >= limit) {
        return
      }
    }
  }
}
