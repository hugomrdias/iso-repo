/**
 * Utilities to work with TypedArrays, BufferSource, and other bytes sources.
 *
 * @module
 */

const typedArrayTypeNames = /** @type {const} */ ([
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
])

const objectTypeNames = /** @type {const} */ ([
  'Function',
  'Generator',
  'AsyncGenerator',
  'GeneratorFunction',
  'AsyncGeneratorFunction',
  'AsyncFunction',
  'Observable',
  'Array',
  'Buffer',
  'Blob',
  'Object',
  'RegExp',
  'Date',
  'Error',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'WeakRef',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'DataView',
  'Promise',
  'URL',
  'FormData',
  'URLSearchParams',
  'HTMLElement',
  'NaN',
  ...typedArrayTypeNames,
])

/**
 * @typedef {typeof typedArrayTypeNames[number]} TypedArrayTypeName
 * @typedef {typeof objectTypeNames[number]} ObjectTypeName
 */

/**
 * @param {unknown} name
 * @returns {name is TypedArrayTypeName}
 */
function isTypedArrayName(name) {
  return typedArrayTypeNames.includes(/** @type {TypedArrayTypeName} */ (name))
}

/**
 * @param {unknown} name
 * @returns {name is ObjectTypeName}
 */
function isObjectTypeName(name) {
  return objectTypeNames.includes(/** @type {ObjectTypeName} */ (name))
}

/**
 * @param {unknown} value
 * @returns {ObjectTypeName | undefined}
 */
export function getObjectType(value) {
  const objectTypeName = toString.call(value).slice(8, -1)

  if (isObjectTypeName(objectTypeName)) {
    return objectTypeName
  }
}

/**
 * @template T
 * @param {ObjectTypeName} type
 */
export function isObjectOfType(type) {
  /**
   * @param {unknown} value
   * @returns {value is T}
   */
  function is(value) {
    return getObjectType(value) === type
  }
  return is
}

/**
 * Check if value is TypeArray
 *
 * @param {unknown} value
 * @returns {value is import("./types").TypedArray}
 */
export function isTypedArray(value) {
  return isTypedArrayName(getObjectType(value))
}

/**
 * @type {(value: unknown) => value is ArrayBuffer}
 */
export const isArrayBuffer = isObjectOfType('ArrayBuffer')

/**
 * Check if value is BufferSource
 *
 * @param {unknown} value
 * @returns {value is BufferSource}
 */
export function isBufferSource(value) {
  return isTypedArray(value) || isArrayBuffer(value)
}

/**
 * @param {unknown} value
 * @returns {value is Uint8Array}
 */
export function isUint8Array(value) {
  return (
    value instanceof Uint8Array ||
    (ArrayBuffer.isView(value) && value.constructor.name === 'Uint8Array')
  )
}

/**
 * Cast typedarray to Uint8Array
 *
 * @param {ArrayBuffer | Int8Array | Uint8ClampedArray | Uint8Array | Uint16Array | Int16Array | Uint32Array | Int32Array } arr
 */
export function u8(arr) {
  return ArrayBuffer.isView(arr)
    ? new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
    : new Uint8Array(arr)
}

/**
 * Cast TypedArray to Buffer
 *
 * @param {BufferSource | string} arr
 * @param {BufferEncoding} [encoding]
 */
export function buf(arr, encoding = 'utf8') {
  if (ArrayBuffer.isView(arr)) {
    return globalThis.Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
  }

  if (typeof arr === 'string') {
    return globalThis.Buffer.from(arr, encoding)
  }

  return globalThis.Buffer.from(arr)
}

/**
 * Returns a new Uint8Array created by concatenating the passed ArrayLikes
 *
 * @param {Array<ArrayLike<number>>} arrays
 * @param {number} [length]
 */
export function concat(arrays, length) {
  if (!length) {
    length = arrays.reduce((acc, curr) => acc + curr.length, 0)
  }

  const output = new Uint8Array(length)
  let offset = 0

  for (const arr of arrays) {
    output.set(arr, offset)
    offset += arr.length
  }

  return output
}

/**
 * Checks if two Uint8Arrays are equal
 *
 * @param {Uint8Array} aa
 * @param {Uint8Array} bb
 */
export function equals(aa, bb) {
  if (aa === bb) {
    return true
  }
  if (aa.byteLength !== bb.byteLength) {
    return false
  }

  for (let ii = 0; ii < aa.byteLength; ii++) {
    if (aa[ii] !== bb[ii]) {
      return false
    }
  }

  return true
}
