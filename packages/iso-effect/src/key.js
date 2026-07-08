/**
 * @typedef {import('./types').Effect} Effect
 */

import { stringify } from 'iso-base/json'

/**
 * Converts arbitrary validated effect input into a JSON-safe value with stable
 * ordering and explicit tags for extended JavaScript types.
 *
 * This is used only for cache-key material, not for persisted effect outputs.
 * Outputs are stored directly through `iso-kv`, which handles its own extended
 * JSON serialization depending on the selected driver.
 *
 * @param {unknown} value
 * @param {WeakSet<object>} seen - Objects already visited while detecting
 * circular references.
 * @returns {unknown}
 */
function normalize(value, seen) {
  if (value === undefined) {
    return { $undefined: true }
  }

  if (value === null || typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return { $number: 'NaN' }
    }
    if (value === Number.POSITIVE_INFINITY) {
      return { $number: 'Infinity' }
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return { $number: '-Infinity' }
    }
    return Object.is(value, -0) ? { $number: '-0' } : value
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'bigint') {
    return { $bigint: value.toString() }
  }

  if (typeof value === 'symbol' || typeof value === 'function') {
    throw new TypeError(
      `Effect inputs cannot contain ${typeof value} values because they cannot be serialized into a cache key.`
    )
  }

  if (value instanceof URL) {
    return { $url: value.toString() }
  }

  if (value instanceof Date) {
    return { $date: value.toISOString() }
  }

  if (value instanceof RegExp) {
    return { $regex: [value.source, value.flags] }
  }

  if (value instanceof Uint8Array) {
    return { $bytes: [...value.values()] }
  }

  if (value instanceof ArrayBuffer) {
    return { $bytes: [...new Uint8Array(value).values()] }
  }

  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'Buffer' &&
    'data' in value &&
    Array.isArray(value.data)
  ) {
    return { $bytes: value.data }
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      throw new TypeError('Effect inputs cannot contain circular references.')
    }
    seen.add(value)
  }

  if (value instanceof Map) {
    const entries = [...value.entries()].map(([key, entryValue]) => [
      normalize(key, seen),
      normalize(entryValue, seen),
    ])
    entries.sort(([a], [b]) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b))
    )
    seen.delete(value)
    return { $map: entries }
  }

  if (value instanceof Set) {
    const entries = [...value.values()].map((entry) => normalize(entry, seen))
    entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    seen.delete(value)
    return { $set: entries }
  }

  if (Array.isArray(value)) {
    const array = value.map((entry) => normalize(entry, seen))
    seen.delete(value)
    return array
  }

  const object = /** @type {Record<string, unknown>} */ (value)
  const normalized = Object.create(null)

  for (const key of Object.keys(object).sort()) {
    normalized[key] = normalize(object[key], seen)
  }

  seen.delete(value)
  return normalized
}

/**
 * Serializes effect input into a stable, extended-JSON string.
 *
 * Object keys are sorted and extended values such as `bigint`, `URL`, `Map`,
 * `Set`, `RegExp`, `Date`, byte arrays, `undefined`, `NaN`, and infinities are
 * represented with explicit tags. Equivalent inputs therefore produce the same
 * string regardless of object insertion order.
 *
 * @param {unknown} value
 */
export function stableStringify(value) {
  return stringify(normalize(value, new WeakSet()))
}

/**
 * FNV-1a 32-bit hash.
 *
 * The hash is intentionally synchronous and small because it runs on every
 * effect call before deduplication. It is used as a cache key component, not as
 * a cryptographic digest.
 *
 * @param {string} value
 */
export function hashString(value) {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Builds the deterministic same-input key for an effect call.
 *
 * The effect name is included so two effects receiving the same input do not
 * share memory or persistent cache entries.
 *
 * @param {Effect} effect
 * @param {unknown} input
 */
export function createCacheKey(effect, input) {
  return hashString(`${effect.name}:${stableStringify(input)}`)
}
