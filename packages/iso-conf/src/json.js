// JSON.stringify and JSON.parse with URL, Map and Uint8Array type support.

/**
 * Recursively converts extended types into JSON-safe tagged objects.
 *
 * @param {any} value
 * @returns {any}
 */
const transform = (value) => {
  if (value instanceof URL) {
    return { $url: value.toString() }
  }

  if (value instanceof Map) {
    return {
      $map: [...value.entries()].map(([key, entryValue]) => [
        transform(key),
        transform(entryValue),
      ]),
    }
  }

  if (value instanceof Uint8Array) {
    return { $bytes: [...value.values()] }
  }

  if (value instanceof ArrayBuffer) {
    return { $bytes: [...new Uint8Array(value).values()] }
  }

  if (value?.type === 'Buffer' && Array.isArray(value.data)) {
    return { $bytes: value.data }
  }

  if (typeof value === 'bigint') {
    return { $bigint: value.toString() }
  }

  if (value instanceof Set) {
    return { $set: [...value.values()].map((entry) => transform(entry)) }
  }

  if (value instanceof RegExp) {
    return { $regex: [value.source, value.flags] }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => transform(entry))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        transform(entryValue),
      ])
    )
  }

  return value
}

/**
 * JSON replacer with URL, Map, Set, bigint, RegExp and Uint8Array support.
 *
 * @param {string} _k - Property key.
 * @param {any} v - Property value.
 */
export const replacer = (_k, v) => {
  if (v instanceof URL) {
    return { $url: v.toString() }
  }
  if (v instanceof Map) {
    return { $map: [...v.entries()] }
  }
  if (v instanceof Uint8Array) {
    return { $bytes: [...v.values()] }
  }
  if (v instanceof ArrayBuffer) {
    return { $bytes: [...new Uint8Array(v).values()] }
  }
  if (v?.type === 'Buffer' && Array.isArray(v.data)) {
    return { $bytes: v.data }
  }
  if (typeof v === 'bigint') {
    return { $bigint: v.toString() }
  }
  if (v instanceof Set) {
    return { $set: [...v.values()] }
  }
  if (v instanceof RegExp) {
    return { $regex: [v.source, v.flags] }
  }
  return v
}

/**
 * JSON reviver with URL, Map, Set, bigint, RegExp and Uint8Array support.
 *
 * @param {string} _k - Property key.
 * @param {any} v - Property value.
 */
export const reviver = (_k, v) => {
  if (!v) return v
  if (v.$url) return new URL(v.$url)
  if (v.$map) return new Map(v.$map)
  if (v.$bytes) return new Uint8Array(v.$bytes)
  if (v.$bigint) return BigInt(v.$bigint)
  if (v.$set) return new Set(v.$set)
  if (v.$regex) return new RegExp(v.$regex[0], v.$regex[1])
  return v
}

/**
 * Serialize a value to extended JSON.
 *
 * @param {any} value - Value to serialize.
 * @param {number|string} [space] - Indentation passed to `JSON.stringify`.
 */
export const stringify = (value, space) =>
  JSON.stringify(transform(value), replacer, space)

/**
 * Parse extended JSON into native JavaScript values.
 *
 * @param {string} value - JSON string to parse.
 */
export const parse = (value) => JSON.parse(value, reviver)
