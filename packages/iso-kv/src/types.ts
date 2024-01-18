/**
 * A value or a promise of a value
 */
export type Await<T> = Promise<T> | T

export interface Options {
  store?: KvStorageAdapterSync | KvStorageAdapterAsync
}

export type KvKeyPart = number | string | Date | BufferSource
export type KvKey = KvKeyPart[]
export interface KVStoredValue<T = unknown> {
  value: T
  expires: number | null
}
export interface KvEntry<T = unknown> {
  key: KvKey
  value: T
}

/**
 * KvListSelector is used to select a range of keys from the database.
 *
 * The selector can either be a prefix selector or a range selector. A prefix selector selects all keys that start with the given prefix (optionally starting at a given key). A range selector selects all keys that are lexicographically between the given start and end keys.
 */
export type KvListSelector =
  | { prefix: KvKey }
  | { prefix: KvKey; start: KvKey }
  | { prefix: KvKey; end: KvKey }
  | { start: KvKey; end: KvKey }

export interface KvListOptions {
  /**
   * The maximum number of key-value pairs to return. If not specified, all matching key-value pairs will be returned.
   */
  limit?: number
  /**
   * Whether to reverse the order of the returned key-value pairs. If not specified, the order will be ascending from the start of the range as per the lexicographical ordering of the keys. If true, the order will be descending from the end of the range.
   
The default value is false.
   */
  reverse?: boolean
}

export type KvListIterator<T> = IterableIterator<T> | AsyncIterableIterator<T>

// export interface KvStorageAdapter {
//   get: <T = unknown>(key: string) => Await<T>
//   has: (key: string) => Await<boolean>
//   set: <T = unknown>(key: string, value: T) => Await<KvStorageAdapter>
//   delete: (key: string) => Await<void>
//   clear: () => Await<void>
//   [Symbol.asyncIterator]?: <T = unknown>() => AsyncIterableIterator<[string, T]>
//   [Symbol.iterator]: <T = unknown>() => IterableIterator<[string, T]>
// }

export type KvStorageAdapter = KvStorageAdapterSync | KvStorageAdapterAsync

export interface KvStorageAdapterSync {
  get: (key: string) => unknown
  has: (key: string) => boolean
  set: (key: string, value: unknown) => KvStorageAdapterSync
  delete: (key: string) => void
  clear: () => void
  [Symbol.iterator]: () => IterableIterator<[string, unknown]>
}

export interface KvStorageAdapterAsync {
  get: (key: string) => Promise<unknown>
  has: (key: string) => Promise<boolean>
  set: (key: string, value: unknown) => Promise<KvStorageAdapterAsync>
  delete: (key: string) => Promise<void>
  clear: () => Promise<void>
  [Symbol.asyncIterator]: () => AsyncIterableIterator<[string, unknown]>
}

export interface IKV {
  onChange: <T = unknown>(
    key: KvKey,
    callback: (newValue?: T, oldValue?: T) => void,
    once?: boolean
  ) => void
  get: <T = unknown>(key: KvKey) => Promise<T | undefined>
  has: (key: KvKey) => Await<boolean>
  /**
   * Set a value in the key-value store.
   *
   * @param key
   * @param value
   * @param ttl - Time-to-live (TTL) for the key. The TTL is specified in milliseconds, and the key will be deleted from the database at earliest after the specified number of milliseconds have elapsed.
   */
  set: <T = unknown>(key: KvKey, value: T, ttl?: number) => Promise<IKV>
  delete: (key: KvKey) => Promise<void>
  clear: () => Promise<void>
  list: <T = unknown>(
    selector: KvListSelector,
    options?: KvListOptions
  ) => KvListIterator<KvEntry<T>>
  [Symbol.asyncIterator]: <T = unknown>() => AsyncIterableIterator<KvEntry<T>>
}

/**
 * Kysely SQL types
 */

export interface KVTable {
  key: string
  value: string
}
export type KVDatabase<Name extends string> = {
  [P in Name]: KVTable
}
