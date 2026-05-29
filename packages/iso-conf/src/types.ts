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
