// JSON.stringify and JSON.parse with URL, Map and Uint8Array type support.

/**
 * Json replacer with URL, Map, Set, BitInt, RegExp and Uint8Array type support.
 *
 * @param {string} _k
 * @param {any} v
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

// const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
/**
 * Json reviver with URL, Map, Set, BitInt, RegExp and Uint8Array type support.
 *
 * @param {string} _k - key
 * @param {any} v - value
 */
export const reviver = (_k, v) => {
  if (!v) return v
  if (v.$url) return new URL(v.$url)
  if (v.$map) return new Map(v.$map)
  if (v.$bytes) return new Uint8Array(v.$bytes)
  if (v.$bigint) return BigInt(v.$bigint)
  //   if (typeof v === 'string' && isoDateRegex.test(v)) return new Date(v)
  if (v.$set) return new Set(v.$set)
  if (v.$regex) return new RegExp(v.$regex[0], v.$regex[1])
  return v
}

/**
 * @param {any} value
 * @param {number|string} [space]
 */
export const stringify = (value, space) =>
  JSON.stringify(value, replacer, space)

/** @param {string} value */
export const parse = (value) => JSON.parse(value, reviver)
