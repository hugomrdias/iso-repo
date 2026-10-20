/**
 * Get, set, check and delete nested properties by dot path.
 *
 * Ported from `dot-prop` 10.2.0 (MIT, Sindre Sorhus) for string paths, with
 * the same semantics: `.` separates properties, `\.` escapes a dot, `[0]`
 * selects an array index, a segment of digits is an array index, and paths
 * through `__proto__`, `prototype` or `constructor` are ignored.
 *
 * @module
 */

const disallowedKeys = new Set(['__proto__', 'prototype', 'constructor'])

/** Longest disallowed key, so longer segments skip the membership check. */
const maxDisallowedKeyLength = 11

/** Largest segment coerced to an array index, to bound memory use. */
const MAX_ARRAY_INDEX = 1_000_000

/**
 * @param {unknown} value
 * @returns {value is Record<PropertyKey, any>}
 */
const isObject = (value) =>
  value !== null && (typeof value === 'object' || typeof value === 'function')

/** @param {string} character */
const isDigit = (character) => character >= '0' && character <= '9'

/**
 * Whether a segment is a non-negative integer without leading zeros.
 *
 * @param {string} segment
 */
const isIndex = (segment) => {
  if (segment === '0') {
    return true
  }

  return /^[1-9]\d*$/.test(segment) && Number(segment) <= MAX_ARRAY_INDEX
}

/**
 * Push a property segment, coercing an index to a number.
 *
 * @param {string} segment
 * @param {Array<string | number>} parts
 * @returns {boolean} `false` when the segment is disallowed.
 */
const pushSegment = (segment, parts) => {
  if (disallowedKeys.has(segment)) {
    return false
  }

  parts.push(segment && isIndex(segment) ? Number(segment) : segment)
  return true
}

/**
 * Split a dot path into property keys and array indexes.
 *
 * @param {string} path
 * @returns {Array<string | number>} Keys, or an empty array when the path
 *   goes through a disallowed key.
 */
export const parsePath = (path) => {
  /** @type {Array<string | number>} */
  const parts = []
  let segment = ''
  let index = ''
  let hadProperty = false
  /** @type {'start' | 'property' | 'index' | 'indexEnd'} */
  let part = 'start'
  let escaping = false
  let position = 0

  for (const character of path) {
    position++

    if (escaping) {
      segment += character
      escaping = false
      continue
    }

    if (character === '\\') {
      if (part === 'index' || part === 'indexEnd') {
        throw new Error(
          `Invalid character '${character}' ${part === 'index' ? 'in' : 'after'} an index at position ${position}`
        )
      }

      escaping = true
      part = part === 'start' ? 'property' : part
      continue
    }

    switch (character) {
      case '.': {
        if (part === 'index') {
          throw new Error(
            `Invalid character '${character}' in an index at position ${position}`
          )
        }

        if (part === 'indexEnd') {
          part = 'property'
          break
        }

        if (!pushSegment(segment, parts)) {
          return []
        }

        segment = ''
        part = 'property'
        break
      }

      case '[': {
        if (part === 'index') {
          throw new Error(
            `Invalid character '${character}' in an index at position ${position}`
          )
        }

        if (part === 'indexEnd') {
          part = 'index'
          break
        }

        if (
          part === 'property' &&
          segment.length <= maxDisallowedKeyLength &&
          disallowedKeys.has(segment)
        ) {
          return []
        }

        hadProperty = part === 'property'
        part = 'index'
        break
      }

      case ']': {
        if (part === 'indexEnd') {
          throw new Error(
            `Invalid character '${character}' after an index at position ${position}`
          )
        }

        if (part !== 'index') {
          // Outside an index, `]` is a literal character.
          if (part === 'start') {
            part = 'property'
          }

          segment += character
          break
        }

        if (index === '') {
          // Empty brackets are literal characters of the property.
          segment += '[]'
          part = 'property'
          break
        }

        if ((segment !== '' || hadProperty) && !pushSegment(segment, parts)) {
          return []
        }

        segment = ''
        hadProperty = false

        const number = Number.parseInt(index, 10)
        parts.push(
          number <= MAX_ARRAY_INDEX && index === String(number) ? number : index
        )
        index = ''
        part = 'indexEnd'
        break
      }

      default: {
        if (part === 'index') {
          if (!isDigit(character)) {
            throw new Error(
              `Invalid character '${character}' in an index at position ${position}`
            )
          }

          index += character
          break
        }

        if (part === 'indexEnd') {
          throw new Error(
            `Invalid character '${character}' after an index at position ${position}`
          )
        }

        if (part === 'start') {
          part = 'property'
        }

        segment += character
      }
    }
  }

  // A trailing backslash is a literal character.
  if (escaping) {
    segment += '\\'
  }

  if (part === 'property') {
    if (!pushSegment(segment, parts)) {
      return []
    }
  } else if (part === 'index') {
    throw new Error('Index was not closed')
  } else if (part === 'start') {
    parts.push('')
  }

  return parts
}

/**
 * Get the value at `path`, or `defaultValue` when it is missing.
 *
 * @param {Record<string, unknown>} object
 * @param {string} path
 * @param {unknown} [defaultValue]
 */
export const getProperty = (object, path, defaultValue) => {
  const keys = parsePath(path)

  if (keys.length === 0) {
    return defaultValue
  }

  /** @type {any} */
  let current = object

  for (let i = 0; i < keys.length; i++) {
    current = current[/** @type {string | number} */ (keys[i])]

    if (current === undefined || current === null) {
      // Missing before the end of the path.
      if (i !== keys.length - 1) {
        return defaultValue
      }

      break
    }
  }

  return current === undefined ? defaultValue : current
}

/**
 * Set the value at `path`, creating missing or primitive intermediate values
 * as arrays before an index and objects otherwise.
 *
 * @param {Record<string, unknown>} object
 * @param {string} path
 * @param {unknown} value
 */
export const setProperty = (object, path, value) => {
  const keys = parsePath(path)
  /** @type {Record<PropertyKey, any>} */
  let current = object

  for (let i = 0; i < keys.length; i++) {
    const key = /** @type {string | number} */ (keys[i])

    if (i === keys.length - 1) {
      current[key] = value
      break
    }

    if (!isObject(current[key])) {
      current[key] = typeof keys[i + 1] === 'number' ? [] : {}
    }

    current = current[key]
  }
}

/**
 * Whether `path` exists, own or inherited.
 *
 * @param {Record<string, unknown>} object
 * @param {string} path
 */
export const hasProperty = (object, path) => {
  const keys = parsePath(path)

  if (keys.length === 0) {
    return false
  }

  /** @type {unknown} */
  let current = object

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return false
    }

    current = current[key]
  }

  return true
}

/**
 * Delete the own property at `path`.
 *
 * @param {Record<string, unknown>} object
 * @param {string} path
 * @returns {boolean} Whether a property was deleted.
 */
export const deleteProperty = (object, path) => {
  const keys = parsePath(path)
  /** @type {Record<PropertyKey, any>} */
  let current = object

  for (let i = 0; i < keys.length; i++) {
    const key = /** @type {string | number} */ (keys[i])

    if (i === keys.length - 1) {
      if (!Object.hasOwn(current, key)) {
        return false
      }

      delete current[key]
      return true
    }

    if (!isObject(current[key])) {
      return false
    }

    current = current[key]
  }

  return false
}
