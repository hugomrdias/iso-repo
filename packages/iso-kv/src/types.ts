/**
 * A value or a promise of a value
 */
export type Await<T> = Promise<T> | T

export interface Options {
  store?: KvStorageAdapter
}

/**
 * New KV types
 */

/** */
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
export type KvListSelector =
  | { prefix: KvKey }
  | { prefix: KvKey; start: KvKey }
  | { prefix: KvKey; end: KvKey }
  | { start: KvKey; end: KvKey }

export interface KvListOptions {
  limit?: number
  reverse?: boolean
}

export type KvListIterator<T> = Iterator<T> | AsyncIterator<T>

export interface KvStorageAdapter {
  get: <T = unknown>(key: string) => Await<T | undefined>
  has: (key: string) => Await<boolean>
  set: <T = unknown>(key: string, value: T) => Await<KvStorageAdapter>
  delete: (key: string) => Await<void>
  clear: () => Await<void>
  [Symbol.asyncIterator]: () => AsyncIterableIterator<{
    key: string
    value: unknown
  }>
  [Symbol.iterator]?: () => IterableIterator<{
    key: string
    value: unknown
  }>
}

export interface Kv {
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
  set: <T = unknown>(key: KvKey, value: T, ttl?: number) => Promise<Kv>
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
