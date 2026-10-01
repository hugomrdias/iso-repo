/**
 * UCAN policy language.
 *
 * @see https://github.com/ucan-wg/delegation#policy
 */

/**
 * @typedef {object} SegmentBase
 * @property {boolean} optional - Whether the segment ends with `?`: when it fails to resolve, the whole selector returns `null`.
 * @property {string} source - The exact text of the selector this segment was parsed from, including a leading `.` and trailing `?`s.
 *
 * @typedef {{ kind: 'identity' }
 *   | { kind: 'field', key: string }
 *   | { kind: 'index', index: number }
 *   | { kind: 'slice', start: number | undefined, end: number | undefined }
 *   | { kind: 'iterate' }
 * } SegmentData
 *
 * @typedef {SegmentData & SegmentBase} SelectorSegment
 */

const IDENT_START = /[A-Za-z_]/
const IDENT_CHAR = /[A-Za-z0-9_]/
const INDEX = /^-?\d+$/
const SLICE = /^(-?\d+)?:(-?\d+)?$/

/**
 * @param {string} selector
 * @param {number} pos
 * @param {string} reason
 */
function selectorError(selector, pos, reason) {
  return new TypeError(
    `Invalid selector ${JSON.stringify(selector)} at position ${pos}: ${reason}`
  )
}

/**
 * @param {string} selector
 * @param {number} pos
 * @param {string} text
 */
function parseInteger(selector, pos, text) {
  const n = Number(text)
  if (!Number.isSafeInteger(n)) {
    throw selectorError(selector, pos, `index ${text} is out of range`)
  }
  return n
}

/**
 * Parse a bracket segment (`["key"]`, `[]`, `[n]`, `[a:b]`) starting at `start`
 * (which must point at `[`).
 *
 * @param {string} selector
 * @param {number} start
 * @returns {{ segment: SegmentData, end: number }}
 */
function parseBracket(selector, start) {
  let pos = start + 1

  // Unambiguous field name: ["any string"] with JSON string escapes.
  if (selector[pos] === '"') {
    let end = pos + 1
    while (end < selector.length && selector[end] !== '"') {
      end += selector[end] === '\\' ? 2 : 1
    }
    if (end >= selector.length) {
      throw selectorError(selector, pos, 'unterminated string')
    }
    /** @type {unknown} */
    let key
    try {
      key = JSON.parse(selector.slice(pos, end + 1))
    } catch (error) {
      throw selectorError(
        selector,
        pos,
        `invalid string literal (${/** @type {Error} */ (error).message})`
      )
    }
    pos = end + 1
    if (selector[pos] !== ']') {
      throw selectorError(selector, pos, 'expected "]" after string')
    }
    return {
      segment: { kind: 'field', key: /** @type {string} */ (key) },
      end: pos + 1,
    }
  }

  const close = selector.indexOf(']', pos)
  if (close === -1) {
    throw selectorError(selector, start, 'unterminated "["')
  }
  const inner = selector.slice(pos, close)

  if (inner === '') {
    return { segment: { kind: 'iterate' }, end: close + 1 }
  }

  if (INDEX.test(inner)) {
    return {
      segment: { kind: 'index', index: parseInteger(selector, pos, inner) },
      end: close + 1,
    }
  }

  const slice = SLICE.exec(inner)
  if (slice && (slice[1] !== undefined || slice[2] !== undefined)) {
    return {
      segment: {
        kind: 'slice',
        start:
          slice[1] === undefined
            ? undefined
            : parseInteger(selector, pos, slice[1]),
        end:
          slice[2] === undefined
            ? undefined
            : parseInteger(selector, pos, slice[2]),
      },
      end: close + 1,
    }
  }

  throw selectorError(
    selector,
    pos,
    `invalid bracket expression "[${inner}]", expected [], [n], [a:b] or ["key"]`
  )
}

/**
 * Parse a UCAN policy selector into segments.
 *
 * Consumes the whole string and throws a `TypeError` on anything that is not
 * valid selector syntax. Supported forms:
 *
 * - `.` identity
 * - `.name` dotted field name, where name matches `[A-Za-z_][A-Za-z0-9_]*`
 * - `["any string"]` unambiguous field name, with JSON string escapes
 * - `[]` collection values
 * - `[n]`, `[-n]` list index
 * - `[a:b]`, `[a:]`, `[:b]` list slice
 * - a trailing `?` on any segment (repeated `?` collapse into one)
 *
 * A selector MUST start with `.` and MUST NOT contain `..`.
 *
 * @see https://github.com/ucan-wg/delegation#selectors
 *
 * @param {string} selector
 * @returns {SelectorSegment[]}
 */
export function parseSelector(selector) {
  if (typeof selector !== 'string') {
    throw new TypeError(
      `Invalid selector: expected a string, got ${typeof selector}`
    )
  }
  if (selector[0] !== '.') {
    throw selectorError(selector, 0, 'must start with "."')
  }

  /** @type {SelectorSegment[]} */
  const segments = []
  let pos = 0

  while (pos < selector.length) {
    const start = pos
    const char = selector[pos]
    /** @type {SegmentData} */
    let segment

    if (char === '.') {
      const next = selector[pos + 1]
      if (next === '.') {
        throw selectorError(selector, pos, '".." is not allowed')
      }
      if (next !== undefined && IDENT_START.test(next)) {
        pos += 2
        while (pos < selector.length && IDENT_CHAR.test(selector[pos])) {
          pos++
        }
        segment = { kind: 'field', key: selector.slice(start + 1, pos) }
      } else if (next === '[') {
        const parsed = parseBracket(selector, pos + 1)
        segment = parsed.segment
        pos = parsed.end
      } else if (next === undefined || next === '?') {
        segment = { kind: 'identity' }
        pos++
      } else {
        throw selectorError(
          selector,
          pos + 1,
          `unexpected character ${JSON.stringify(next)} after "."`
        )
      }
    } else if (char === '[') {
      const parsed = parseBracket(selector, pos)
      segment = parsed.segment
      pos = parsed.end
    } else {
      throw selectorError(
        selector,
        pos,
        `unexpected character ${JSON.stringify(char)}`
      )
    }

    let optional = false
    while (selector[pos] === '?') {
      optional = true
      pos++
    }

    segments.push(
      /** @type {SelectorSegment} */ ({
        ...segment,
        optional,
        source: selector.slice(start, pos),
      })
    )
  }

  return segments
}

/**
 * Returned by {@link resolve} when a selector can't be resolved.
 */
const FAIL = Symbol('fail')

/**
 * Plain IPLD map (a JS object that is not an array, bytes, CID or class instance).
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isMap(value) {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * @param {unknown} value
 * @returns {value is unknown[] | Uint8Array}
 */
function isList(value) {
  return Array.isArray(value) || value instanceof Uint8Array
}

/**
 * Resolve a single segment, or return {@link FAIL}.
 *
 * @param {unknown} value
 * @param {SelectorSegment} segment
 * @returns {unknown}
 */
function resolveSegment(value, segment) {
  switch (segment.kind) {
    case 'identity':
      return value
    case 'field':
      if (!isMap(value)) return FAIL
      // Missing keys resolve to null. Only own keys count, so `__proto__`,
      // `constructor` and friends are missing unless they are in the data.
      return Object.hasOwn(value, segment.key) ? value[segment.key] : null
    case 'index': {
      if (!isList(value)) return FAIL
      const index =
        segment.index < 0 ? value.length + segment.index : segment.index
      if (index < 0 || index >= value.length) return FAIL
      return value[index]
    }
    case 'slice':
      if (!isList(value)) return FAIL
      return value.slice(segment.start, segment.end)
    case 'iterate':
      if (isList(value)) return value
      if (isMap(value)) return Object.values(value)
      return FAIL
    default:
      return FAIL
  }
}

/**
 * Resolve parsed selector segments against data.
 *
 * Segments are resolved left to right. When a segment fails, the selector
 * returns `null` if that segment is optional, otherwise {@link FAIL}. Either
 * way, resolution stops at the first failure.
 *
 * @param {unknown} data
 * @param {SelectorSegment[]} segments
 * @returns {unknown}
 */
function resolve(data, segments) {
  let current = data
  for (const segment of segments) {
    const next = resolveSegment(current, segment)
    if (next === FAIL) {
      return segment.optional ? null : FAIL
    }
    current = next
  }
  return current
}

/**
 * Resolve a selector against data.
 *
 * @param {unknown} data - The data to select from.
 * @param {string} selector - The selector, e.g. `.foo[0].bar`.
 * @returns {{ ok: true, value: unknown } | { ok: false }} `ok: false` when the selector can't be resolved.
 * @throws {TypeError} If the selector is not valid syntax.
 */
export function select(data, selector) {
  const value = resolve(data, parseSelector(selector))
  return value === FAIL ? { ok: false } : { ok: true, value }
}

/**
 * Compare two numbers that may be `number` or `bigint`.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {-1 | 0 | 1 | undefined} `undefined` when either side is not a number, or is NaN.
 */
function compareNumbers(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) || Number.isNaN(b)) return undefined
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (typeof a === 'bigint' && typeof b === 'bigint') {
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (typeof a === 'bigint' && typeof b === 'number') {
    const r = compareNumbers(b, a)
    return r === undefined ? undefined : /** @type {-1 | 0 | 1} */ (-r || 0)
  }
  if (typeof a === 'number' && typeof b === 'bigint') {
    if (Number.isNaN(a)) return undefined
    if (!Number.isFinite(a)) return a > 0 ? 1 : -1
    if (Number.isInteger(a)) {
      const ai = BigInt(a)
      return ai < b ? -1 : ai > b ? 1 : 0
    }
    // a is not an integer, so it is never equal to b, and
    // floor(a) < a < floor(a) + 1.
    return BigInt(Math.floor(a)) < b ? -1 : 1
  }
  return undefined
}

/**
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 */
function bytesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Deep equality between IPLD values.
 *
 * `number` and `bigint` are compared by numeric value, so `1 == 1n`.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  if (a === b) return true

  const numeric = compareNumbers(a, b)
  if (numeric !== undefined) return numeric === 0

  if (a instanceof Uint8Array || b instanceof Uint8Array) {
    return (
      a instanceof Uint8Array && b instanceof Uint8Array && bytesEqual(a, b)
    )
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  if (isMap(a) && isMap(b)) {
    const keys = Object.keys(a)
    if (keys.length !== Object.keys(b).length) return false
    for (const key of keys) {
      if (!Object.hasOwn(b, key) || !deepEqual(a[key], b[key])) return false
    }
    return true
  }

  // CIDs and other objects with an `equals` method (e.g. multiformats CID).
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    'equals' in a &&
    typeof a.equals === 'function' &&
    Object.getPrototypeOf(a) === Object.getPrototypeOf(b)
  ) {
    return Boolean(a.equals(b))
  }

  return false
}

/**
 * Converts a UCAN glob pattern to a regular expression.
 *
 * `*` matches zero or more characters, including newlines. `\*` matches a
 * literal `*`. The spec defines no other escapes, so a `\` that is not
 * followed by `*` is a literal backslash. For example, the pattern `\\*` is a
 * literal `\` followed by `\*`, and only matches the string `\*`.
 *
 * @see https://github.com/ucan-wg/delegation#glob-matching
 *
 * @param {string} pattern
 * @returns {RegExp}
 */
export function likeRegex(pattern) {
  let regex = '^'
  let i = 0
  while (i < pattern.length) {
    const char = pattern[i]
    if (char === '\\' && pattern[i + 1] === '*') {
      regex += '\\*'
      i += 2
    } else if (char === '*') {
      regex += '[\\s\\S]*'
      i++
    } else {
      regex += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      i++
    }
  }
  regex += '$'
  return new RegExp(regex)
}

/**
 * @typedef {{ op: '==', selector: SelectorSegment[], value: unknown }
 *   | { op: '<' | '<=' | '>' | '>=', selector: SelectorSegment[], value: number | bigint }
 *   | { op: 'like', selector: SelectorSegment[], regex: RegExp }
 *   | { op: 'not', statement: CompiledStatement }
 *   | { op: 'and' | 'or', statements: CompiledStatement[] }
 *   | { op: 'all' | 'any', selector: SelectorSegment[], statement: CompiledStatement }
 * } CompiledStatement
 */

/**
 * @param {unknown} statement
 * @param {string} reason
 */
function statementError(statement, reason) {
  let text
  try {
    text = JSON.stringify(statement, (_, v) =>
      typeof v === 'bigint' ? `${v}n` : v
    )
  } catch {
    text = String(statement)
  }
  return new TypeError(`Invalid policy statement ${text}: ${reason}`)
}

/**
 * @param {unknown[]} statement
 * @param {number} arity
 */
function assertArity(statement, arity) {
  if (statement.length !== arity) {
    throw statementError(
      statement,
      `"${statement[0]}" takes ${arity - 1} argument(s), got ${statement.length - 1}`
    )
  }
}

/**
 * Check the structure of a statement and parse its selectors.
 *
 * @param {unknown} statement
 * @returns {CompiledStatement}
 * @throws {TypeError} If the statement is malformed.
 */
function compileStatement(statement) {
  if (!Array.isArray(statement)) {
    throw statementError(statement, 'expected an array')
  }
  const op = statement[0]
  switch (op) {
    case '==':
    case '!=': {
      assertArity(statement, 3)
      /** @type {CompiledStatement} */
      const eq = {
        op: '==',
        selector: parseSelector(statement[1]),
        value: statement[2],
      }
      // `!=` is defined as `["not", ["==", selector, value]]`.
      return op === '==' ? eq : { op: 'not', statement: eq }
    }
    case '<':
    case '<=':
    case '>':
    case '>=': {
      assertArity(statement, 3)
      const value = statement[2]
      if (
        typeof value !== 'bigint' &&
        (typeof value !== 'number' || !Number.isFinite(value))
      ) {
        throw statementError(statement, 'value must be a number')
      }
      return { op, selector: parseSelector(statement[1]), value }
    }
    case 'like': {
      assertArity(statement, 3)
      const pattern = statement[2]
      if (typeof pattern !== 'string') {
        throw statementError(statement, 'pattern must be a string')
      }
      return {
        op,
        selector: parseSelector(statement[1]),
        regex: likeRegex(pattern),
      }
    }
    case 'not':
      assertArity(statement, 2)
      return { op, statement: compileStatement(statement[1]) }
    case 'and':
    case 'or':
      assertArity(statement, 2)
      if (!Array.isArray(statement[1])) {
        throw statementError(statement, 'expected an array of statements')
      }
      return { op, statements: statement[1].map(compileStatement) }
    case 'all':
    case 'any':
      assertArity(statement, 3)
      return {
        op,
        selector: parseSelector(statement[1]),
        statement: compileStatement(statement[2]),
      }
    default:
      throw statementError(statement, `unknown operator ${String(op)}`)
  }
}

/**
 * Check the structure of a policy and parse its selectors.
 *
 * This does not check that `==` / `!=` values are IPLD values. Delegations
 * are fully validated with `assertPolicy` (in `utils.js`) when created or
 * decoded.
 *
 * @param {unknown} policy
 * @returns {CompiledStatement[]}
 * @throws {TypeError} If the policy is malformed.
 */
export function compilePolicy(policy) {
  if (!Array.isArray(policy)) {
    throw new TypeError('Invalid policy: expected an array of statements')
  }
  return policy.map(compileStatement)
}

/**
 * Evaluates a compiled statement against data.
 *
 * @param {unknown} data
 * @param {CompiledStatement} statement
 * @returns {boolean}
 */
function evaluate(data, statement) {
  switch (statement.op) {
    case '==': {
      const selected = resolve(data, statement.selector)
      return selected !== FAIL && deepEqual(selected, statement.value)
    }
    case '<':
    case '<=':
    case '>':
    case '>=': {
      const selected = resolve(data, statement.selector)
      if (selected === FAIL) return false
      const cmp = compareNumbers(selected, statement.value)
      if (cmp === undefined) return false
      if (statement.op === '<') return cmp < 0
      if (statement.op === '<=') return cmp <= 0
      if (statement.op === '>') return cmp > 0
      return cmp >= 0
    }
    case 'like': {
      const selected = resolve(data, statement.selector)
      return typeof selected === 'string' && statement.regex.test(selected)
    }
    case 'not':
      return !evaluate(data, statement.statement)
    case 'and':
      return statement.statements.every((s) => evaluate(data, s))
    case 'or':
      return (
        statement.statements.length === 0 ||
        statement.statements.some((s) => evaluate(data, s))
      )
    case 'all':
    case 'any': {
      const selected = resolve(data, statement.selector)
      /** @type {unknown[]} */
      let items
      if (Array.isArray(selected)) {
        items = selected
      } else if (isMap(selected)) {
        items = Object.values(selected)
      } else {
        // Quantifying over a non-collection (or an unresolvable selector) is false.
        return false
      }
      // Like `and` / `or`, an empty collection is true for both quantifiers.
      if (items.length === 0) return true
      return statement.op === 'all'
        ? items.every((item) => evaluate(item, statement.statement))
        : items.some((item) => evaluate(item, statement.statement))
    }
    default:
      return false
  }
}

/**
 * Validates invocation arguments against a UCAN policy.
 *
 * A malformed policy (unknown operator, wrong arity, invalid selector, ...)
 * never validates: the result is `false` for any `args`.
 *
 * @template {unknown} Args
 * @param {Args} args The arguments of the eventual invocation.
 * @param {import("./types.js").Policy<Args>} policy An array of policy statements.
 * @returns {boolean} True if the args are valid according to the policy, false otherwise.
 */
export function validate(args, policy) {
  /** @type {CompiledStatement[]} */
  let compiled
  try {
    compiled = compilePolicy(policy)
  } catch {
    return false
  }
  // The top-level policy is an implicit 'and'.
  return compiled.every((statement) => evaluate(args, statement))
}
