import type { StandardSchemaV1 } from '@standard-schema/spec'

export type { StandardSchemaV1 } from '@standard-schema/spec'

export type Serialize = (value: unknown) => string

export type Deserialize = (value: string) => unknown

export type OnDidChangeCallback<Value = unknown> = (
  newValue: Value | undefined,
  oldValue: Value | undefined
) => void

export type OnDidAnyChangeCallback<T extends Record<string, unknown>> = (
  newValue: T,
  oldValue: T
) => void

export type Unsubscribe = () => void

export interface Options<Schema extends StandardSchemaV1 = StandardSchemaV1> {
  schema?: Schema
  projectName?: string
  cwd?: string
  configName?: string
  fileExtension?: string
  projectSuffix?: string
  accessPropertiesByDotNotation?: boolean
  clearInvalidConfig?: boolean
  watch?: boolean
  configFileMode?: number
  serialize?: Serialize
  deserialize?: Deserialize
}
