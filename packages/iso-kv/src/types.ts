import type { z } from 'zod'

/**
 * A value or a promise of a value
 */
export type Await<T> = Promise<T> | T

export type DefaultKey = string | number | symbol
export type DefaultRecord = Record<DefaultKey, any>
export type SchemaDefault = z.ZodRecord<z.ZodString | z.ZodNumber | z.ZodSymbol>
export type SchemaConstrains = SchemaDefault | z.ZodObject<any>
export interface DeserializedData<TValue> {
  value: TValue
  expires: number | null
}

export interface Options<S extends SchemaConstrains> {
  schema?: S
  ttl?: number
  store: Store
  serialize?: <TValue>(value: DeserializedData<TValue>) => Await<unknown>
  deserialize?: <TValue>(value: unknown) => Await<DeserializedData<TValue>>
}

export interface IKv<
  T extends DefaultRecord = Record<DefaultKey, unknown>,
  Key extends keyof T = keyof T,
> {
  get: (key: Key) => Promise<T[Key] | undefined>
  has: (key: Key) => Promise<boolean>
  /**
   * Set a value in the key-value store.
   *
   * @param key
   * @param value
   * @param ttl - Time-to-live (TTL) for the key. The TTL is specified in milliseconds, and the key will be deleted from the database at earliest after the specified number of milliseconds have elapsed.
   */
  set: (key: Key, value: T[Key], ttl?: number) => Promise<boolean>
  delete: (key: Key) => Promise<void>
  clear: () => Promise<void>
  onChange: (
    key: Key,
    callback: (newValue?: T[Key], oldValue?: T[Key]) => void,
    once?: boolean
  ) => void
  [Symbol.asyncIterator]: () => AsyncIterableIterator<[Key, T[Key]]>
}

export interface Store {
  get: (key: DefaultKey) => Await<unknown | undefined>
  has: (key: DefaultKey) => Await<boolean>
  set: (key: DefaultKey, value: unknown) => Await<Store>
  delete: (key: DefaultKey) => Await<void>
  clear: () => Await<void>
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<[DefaultKey, unknown]>
  [Symbol.iterator]?: () => IterableIterator<[DefaultKey, unknown]>
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
