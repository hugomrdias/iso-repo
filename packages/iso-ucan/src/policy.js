/**
 * @import {Statement} from './types.js'
 */

/**
 * Resolves a selector string against a data object, inspired by jq.
 *
 * @param {any} data The data to select from.
 * @param {string} selector The selector string (e.g., ".foo[0].bar").
 * @returns {any} The selected value, or null if the selection fails at an optional part.
 * @throws {Error} If the selection fails at a non-optional part.
 */
function resolveSelector(data, selector) {
  if (selector === '.') {
    return data
  }

  // This regex is a simplified parser for the selector syntax.
  const partsRegex = /(\.[\w_]+|\[-?\d*:-?\d*\]|\[-?\d+\]|\[\]|\?)/g
  const parts = selector.match(partsRegex) || []

  let currentData = data

  for (let part of parts) {
    let isOptional = false
    if (part.endsWith('?')) {
      isOptional = true
      part = part.slice(0, -1)
    }

    try {
      if (currentData === undefined || currentData === null) {
        throw new Error(
          `Cannot process part "${part}" on null or undefined value.`
        )
      }

      if (part.startsWith('.')) {
        const key = part.substring(1)
        if (typeof currentData !== 'object' || Array.isArray(currentData)) {
          throw new Error(`Cannot access key "${key}" on non-object.`)
        }
        currentData = currentData[key]
      } else if (part === '[]') {
        if (Array.isArray(currentData)) {
          // No-op for arrays, the quantifier will iterate over it.
        } else if (typeof currentData === 'object') {
          currentData = Object.values(currentData)
        } else {
          throw new Error('Cannot extract values from non-collection.')
        }
      } else if (part.startsWith('[') && part.includes(':')) {
        // Slice
        if (!Array.isArray(currentData)) {
          throw new Error('Slice can only be applied to arrays.')
        }
        const [start, end] = part
          .substring(1, part.length - 1)
          .split(':')
          .map((s) => (s ? Number.parseInt(s, 10) : undefined))
        currentData = currentData.slice(start, end)
      } else if (part.startsWith('[')) {
        // Index
        if (!Array.isArray(currentData)) {
          throw new Error('Index can only be applied to arrays.')
        }
        const index = Number.parseInt(part.substring(1, part.length - 1), 10)
        currentData =
          currentData[index < 0 ? currentData.length + index : index]
      }

      if (currentData === undefined) {
        throw new Error(`Path segment returned undefined: ${part}`)
      }
    } catch (e) {
      if (isOptional) {
        return null
      }
      // Re-throw if not optional, to be caught by evaluateStatement
      throw e
    }
  }

  return currentData
}

/**
 * Performs a deep equality check between two values.
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (a.constructor !== b.constructor) return false
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false
      }
      return true
    }
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (const key of keys) {
      // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
      if (!b.hasOwnProperty(key) || !deepEqual(a[key], b[key])) return false
    }
    return true
  }
  return false
}

/**
 * Evaluates a single policy statement against the invocation args.
 *
 * @param {object} args The invocation arguments.
 * @param {Statement} statement The policy statement.
 * @returns {boolean} The result of the evaluation.
 */
function evaluateStatement(args, statement) {
  console.log('🚀 ~ evaluateStatement ~ statement:', statement)

  const [op, ...params] = statement

  try {
    switch (op) {
      // Comparisons
      case '==': {
        const [selector, value] = /** @type {[string, unknown]} */ (params)
        return deepEqual(resolveSelector(args, selector), value)
      }
      case '!=': {
        const [selector, value] = /** @type {[string, unknown]} */ (params)
        return !deepEqual(resolveSelector(args, selector), value)
      }
      case '>':
      case '>=':
      case '<':
      case '<=': {
        const [selector, value] = /** @type {[string, number]} */ (params)
        const selected = resolveSelector(args, selector)
        if (typeof selected !== 'number' || typeof value !== 'number')
          return false
        if (op === '>') return selected > value
        if (op === '>=') return selected >= value
        if (op === '<') return selected < value
        if (op === '<=') return selected <= value
        break
      }
      // Glob Matching
      case 'like': {
        const [selector, pattern] = /** @type {[string, string]} */ (params)
        const selected = resolveSelector(args, selector)
        if (typeof selected !== 'string') return false
        const regex = new RegExp(
          `^${pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*')}$`
        )
        return regex.test(selected)
      }
      // Connectives
      case 'and': {
        const [statements] = /** @type {[Statement[]]} */ (params)
        return statements.every((stmt) => evaluateStatement(args, stmt))
      }
      case 'or': {
        const [statements] = /** @type {[Statement[]]} */ (params)
        return statements.some((stmt) => evaluateStatement(args, stmt))
      }
      case 'not': {
        const [statement] = /** @type {[Statement]} */ (params)
        return !evaluateStatement(args, statement)
      }
      // Quantification
      case 'all':
      case 'any': {
        const [selector, innerStmt] = /** @type {[string, Statement]} */ (
          params
        )
        let collection = resolveSelector(args, selector)
        if (
          collection &&
          typeof collection === 'object' &&
          !Array.isArray(collection)
        ) {
          collection = Object.values(collection)
        }
        if (!Array.isArray(collection)) return false
        if (collection.length === 0) return true

        if (op === 'all') {
          return collection.every((item) => evaluateStatement(item, innerStmt))
        }
        // any
        return collection.some((item) => evaluateStatement(item, innerStmt))
      }
      default:
        return false // Unknown operator
    }
  } catch (e) {
    // As per the spec, if a selector cannot be resolved, the statement MUST return false.
    return false
  }
  return false
}

/**
 * Validates invocation arguments against a UCAN policy.
 *
 * @param {Record<string, unknown>} args The arguments of the eventual invocation.
 * @param {import("./types.js").Policy} policy An array of policy statements.
 * @returns {boolean} True if the args are valid according to the policy, false otherwise.
 */
export function validate(args, policy) {
  // The top-level policy is an implicit 'and'.
  return policy.every((statement) => evaluateStatement(args, statement))
}
