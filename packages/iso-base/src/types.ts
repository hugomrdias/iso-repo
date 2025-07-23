export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array

export interface Codec {
  /**
   * Encode bytes or utf8 string to string
   *
   * @param data - Data to be encoded to string
   * @param pad - Should have padding. Defaults: true
   */
  encode: (data: BufferSource | string, pad?: boolean) => string
  decode: (data: BufferSource | string) => Uint8Array
}

/**
 * Generic types
 */

// biome-ignore lint/complexity/noBannedTypes: needed
export type IsAny<T> = unknown extends T ? (T extends {} ? T : never) : never

export type NotAny<T> = T extends IsAny<T> ? never : T
