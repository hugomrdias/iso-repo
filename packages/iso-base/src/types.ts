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
  encode: (data: Uint8Array | string, pad?: boolean) => string
  decode: (data: Uint8Array | string) => Uint8Array
}

/**
 * Generic types
 */

// biome-ignore lint/complexity/noBannedTypes: needed
export type IsAny<T> = unknown extends T ? (T extends {} ? T : never) : never

export type NotAny<T> = T extends IsAny<T> ? never : T

/**
 * ISOBuffer
 */

// Forward reference for ISOBuffer class
interface ISOBufferLike {
  buffer: ArrayBufferLike
  byteLength: number
  byteOffset: number
}

/**
 * Valid input types for ISOBuffer constructor
 */
export type ISOBufferInput =
  | number
  | ArrayBufferLike
  | ArrayBufferView
  | ISOBufferLike

/**
 * Options for ISOBuffer constructor
 */
export interface ISOBufferOptions {
  /**
   * Byte offset to start from within the buffer
   */
  offset?: number
  /**
   * Use little-endian byte order for multi-byte operations.
   * Defaults to true.
   */
  littleEndian?: boolean
}
