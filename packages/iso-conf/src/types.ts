import type { StandardSchemaV1 } from '@standard-schema/spec'

export type { StandardSchemaV1 } from '@standard-schema/spec'

/** Serializes a config value to a UTF-8 string. */
export type Serialize = (value: unknown) => string

/** Deserializes a config value from a UTF-8 string. */
export type Deserialize = (value: string) => unknown

/** Called when a watched config key changes. */
export type OnDidChangeCallback<Value = unknown> = (
  newValue: Value | undefined,
  oldValue: Value | undefined
) => void

/** Called when any part of the config object changes. */
export type OnDidAnyChangeCallback<T extends Record<string, unknown>> = (
  newValue: T,
  oldValue: T
) => void

/** Removes a change listener registered with `onDidChange` or `onDidAnyChange`. */
export type Unsubscribe = () => void

type JsonPrimitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined

type LiteralUnion<
  LiteralType extends BaseType,
  BaseType extends JsonPrimitive,
> = LiteralType | (BaseType & Record<never, never>)

type KnownStringKeys<T> = Extract<
  keyof {
    [Key in keyof T as Key extends string
      ? string extends Key
        ? never
        : Key
      : never]: T[Key]
  },
  string
>

type KnownPath<T> = unknown extends T
  ? never
  : NonNullable<T> extends readonly unknown[]
    ? never
    : NonNullable<T> extends object
      ? {
          [Key in KnownStringKeys<NonNullable<T>>]:
            | Key
            | (KnownPath<NonNullable<T>[Key]> extends infer ChildPath extends
                string
                ? `${Key}.${ChildPath}`
                : never)
        }[KnownStringKeys<NonNullable<T>>]
      : never

type PathValue<T, KeyPath extends string> = unknown extends T
  ? unknown
  : T extends undefined
    ? undefined
    : KeyPath extends `${infer Key}.${infer Rest}`
      ? Key extends keyof NonNullable<T>
        ? PathValue<NonNullable<T>[Key], Rest>
        : unknown
      : KeyPath extends keyof NonNullable<T>
        ? NonNullable<T>[KeyPath]
        : unknown

/** Config object inferred from a Standard Schema. */
export type SchemaValues<Schema extends StandardSchemaV1> =
  StandardSchemaV1.InferOutput<Schema>

type SchemaKnownPath<Schema extends StandardSchemaV1> = Extract<
  KnownPath<SchemaValues<Schema>>,
  string
>

/** Config value inferred from a Standard Schema and key path. */
export type SchemaValue<
  Schema extends StandardSchemaV1,
  KeyPath extends string,
> = string extends KeyPath ? unknown : PathValue<SchemaValues<Schema>, KeyPath>

/** Config key path inferred from a Standard Schema. */
export type SchemaKeyPath<Schema extends StandardSchemaV1> = [
  SchemaKnownPath<Schema>,
] extends [never]
  ? string
  : LiteralUnion<SchemaKnownPath<Schema>, string>

/** Array item inferred from a Standard Schema and key path. */
export type SchemaArrayElement<
  Schema extends StandardSchemaV1,
  KeyPath extends string,
> =
  unknown extends SchemaValue<Schema, KeyPath>
    ? unknown
    : NonNullable<
          SchemaValue<Schema, KeyPath>
        > extends readonly (infer Element)[]
      ? Element
      : never

/** Iterator entry inferred from a Standard Schema. */
export type SchemaEntry<Schema extends StandardSchemaV1> =
  unknown extends SchemaValues<Schema>
    ? [string, unknown]
    : {
        [Key in Extract<keyof SchemaValues<Schema>, string>]: [
          Key,
          SchemaValues<Schema>[Key],
        ]
      }[Extract<keyof SchemaValues<Schema>, string>]

/** Options for creating a {@link Conf} instance. */
export interface Options<Schema extends StandardSchemaV1 = StandardSchemaV1> {
  /** Standard Schema used to validate the full config object. */
  schema?: Schema
  /** Project name used to resolve the default config directory. Required unless `cwd` is set. */
  projectName?: string
  /** Directory where the config file is stored. Overrides `projectName`. */
  cwd?: string
  /** Config file name without extension. @default 'config' */
  configName?: string
  /** Config file extension without a leading dot. @default 'json' */
  fileExtension?: string
  /** Suffix appended to `projectName` in the config path. @default 'nodejs' */
  projectSuffix?: string
  /** Access nested properties using dot notation. @default true */
  accessPropertiesByDotNotation?: boolean
  /** Reset to an empty config when the file is invalid. @default false */
  clearInvalidConfig?: boolean
  /** Watch the config file for external changes. @default false */
  watch?: boolean
  /** File mode used when creating the config file. @default 0o666 */
  configFileMode?: number
  /** Custom serializer. Defaults to extended JSON via `stringify`. */
  serialize?: Serialize
  /** Custom deserializer. Defaults to extended JSON via `parse`. */
  deserialize?: Deserialize
}
