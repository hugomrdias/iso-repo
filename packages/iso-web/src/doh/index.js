import { request } from '../http.js'
import { LRUCache } from '../lru.js'

const symbol = Symbol.for('doh-error')

/**
 * @typedef {import('../http.js').RequestJsonErrors | DohError} DoHErrors
 * @typedef {import('../http.js').RequestJsonErrors} RequestErrors
 * @typedef {import('./types.js').DohCache} DohCache
 */

export {
  AbortError,
  HttpError,
  JsonError,
  NetworkError,
  RequestError,
  SchemaError,
  TimeoutError,
} from '../http.js'

/**
 * Check if a value is a DohError
 *
 * @param {unknown} value
 * @returns {value is DohError}
 */
export function isDohError(value) {
  return value instanceof Error && symbol in value
}

export class DohError extends Error {
  /** @type {boolean} */
  [symbol] = true

  name = 'DohError'

  /** @type {unknown} */
  cause

  /** @type {import('./types.js').DoHResponse} */
  data

  /**
   *
   * @param {string} message
   * @param {ErrorOptions & {data: import('./types.js').DoHResponse}} options
   */
  constructor(message, options) {
    super(message, options)

    this.cause = options.cause
    this.data = options.data
  }

  /**
   * Check if a value is a DohError
   *
   * @param {unknown} value
   * @returns {value is DohError}
   */
  static is(value) {
    return isDohError(value) && value.name === 'DohError'
  }
}

/**
 * DoH Status to Description
 *
 * @param {number} status
 */
function statusToDescription(status) {
  switch (status) {
    case 1: {
      return 'DNS query format error'
    }
    case 2: {
      return 'Server failed to complete the DNS request'
    }
    case 3: {
      return 'Domain name does not exist'
    }
    case 4: {
      return 'Not implemented'
    }
    case 5: {
      return 'Server refused to answer for the query'
    }
    case 6: {
      return 'Name that should not exist, does exist'
    }
    case 7: {
      return 'RRset that should not exist, does exist'
    }
    case 8: {
      return 'RRset that should exist, does not exist'
    }
    case 9: {
      return 'Server not authoritative for the zone'
    }
    case 10: {
      return 'Name not in zone'
    }
    case 11: {
      return 'DSO-TYPE Not Implemented'
    }
    case 16: {
      return 'Bad OPT Version / TSIG Signature Failure'
    }
    case 17: {
      return 'Key not recognized'
    }
    case 18: {
      return 'Signature out of time window'
    }
    case 19: {
      return 'Bad TKEY Mode'
    }
    case 20: {
      return 'Duplicate key name'
    }
    case 21: {
      return 'Algorithm not supported'
    }
    case 22: {
      return 'Bad Truncation'
    }
    case 23: {
      return 'Bad/missing Server Cookie'
    }

    default: {
      if (typeof status === 'number') {
        return 'Unassigned or reserved error code'
      }
      return 'DNS Status is not defined'
    }
  }
}

/**
 * DNS resource record type numbers
 *
 * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
 *
 * @type {Record<import('./types.js').RecordType, number>}
 */
const RECORD_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  NAPTR: 35,
  CAA: 257,
}

/** Negative cache TTL in seconds when the response has no SOA record */
const NEGATIVE_TTL_FALLBACK = 300
/** Upper bound for negative cache TTLs in seconds */
const NEGATIVE_TTL_MAX = 3600
/** Cache TTL in seconds for deterministic DoH error statuses */
const ERROR_TTL = 3600

/**
 * Negative cache TTL for NXDOMAIN and NODATA responses: the minimum of the SOA
 * record TTL and its MINIMUM field.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc2308#section-5
 *
 * @param {import('./types.js').DoHResponse} response
 */
function negativeTtl(response) {
  const soa = response.Authority?.find((a) => a.type === RECORD_TYPES.SOA)
  if (!soa || !Number.isFinite(soa.TTL)) {
    return NEGATIVE_TTL_FALLBACK
  }
  // SOA data: mname rname serial refresh retry expire minimum
  const minimum = Number(soa.data.trim().split(/\s+/)[6])
  const ttl = Number.isFinite(minimum) ? Math.min(soa.TTL, minimum) : soa.TTL
  return Math.max(0, Math.min(ttl, NEGATIVE_TTL_MAX))
}

/**
 * Cache TTL for a non-zero DoH status, `undefined` when it should not be cached
 *
 * @param {import('./types.js').DoHResponse} response
 */
function errorTtl(response) {
  switch (response.Status) {
    // SERVFAIL and REFUSED are usually transient
    case 2:
    case 5: {
      return undefined
    }
    // NXDOMAIN
    case 3: {
      return negativeTtl(response)
    }
    default: {
      return ERROR_TTL
    }
  }
}

const QUOTED_STRINGS = /^\s*(?:"(?:[^"\\]|\\.)*"\s*)+$/s
const QUOTED_STRING = /"((?:[^"\\]|\\.)*)"/gs
const ESCAPE = /\\(25[0-5]|2[0-4]\d|[01]\d\d|.)/gs
const DECIMAL_ESCAPE = /^\d{3}$/
const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Parse TXT record data into a single string.
 *
 * Some DoH servers (e.g. Cloudflare) return the presentation format: one or
 * more quoted character-strings with `\X` and `\DDD` escapes, which are
 * unescaped and concatenated. Others (e.g. Google) return the concatenated
 * value unquoted, which is returned as is.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc1035#section-5.1
 * @see https://datatracker.ietf.org/doc/html/rfc7208#section-3.3
 *
 * @param {string} data
 */
function parseTxt(data) {
  if (!QUOTED_STRINGS.test(data)) {
    return data
  }

  // `\DDD` escapes are bytes, so decode everything as UTF-8 bytes
  /** @type {number[]} */
  const bytes = []
  for (const [, value] of data.matchAll(QUOTED_STRING)) {
    let last = 0
    for (const match of value.matchAll(ESCAPE)) {
      bytes.push(...encoder.encode(value.slice(last, match.index)))
      bytes.push(
        ...(DECIMAL_ESCAPE.test(match[1])
          ? [Number(match[1])]
          : encoder.encode(match[1]))
      )
      last = match.index + match[0].length
    }
    bytes.push(...encoder.encode(value.slice(last)))
  }
  return decoder.decode(new Uint8Array(bytes))
}

const defaultCache = new LRUCache({ max: 1000 })
/**
 * Resolve a DNS query using DNS over HTTPS
 *
 * @see https://developers.google.com/speed/public-dns/docs/doh/json
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
 *
 * @template {string[]} [T=string[]]
 *
 * @param {string} query
 * @param {import("./types.js").RecordType} type
 * @param {import("./types.js").ResolveOptions} [options]
 * @returns {Promise<import("../types.js").MaybeResult<T, DoHErrors>>}
 */
export async function resolve(query, type, options = {}) {
  const { cache = defaultCache } = options
  const {
    server = 'https://cloudflare-dns.com/dns-query',
    signal,
    retry,
    timeout,
  } = options
  const requestUrl = new URL(server)
  requestUrl.searchParams.set('name', query)
  requestUrl.searchParams.set('type', type)
  const url = requestUrl.toString()

  const cached =
    /** @type {import('../types.js').MaybeResult<T, DoHErrors> | undefined} */ (
      await cache.get([url])
    )
  if (cached) {
    return cached
  }

  const { error, result: rawResult } = await request.json(requestUrl, {
    signal,
    headers: { accept: 'application/dns-json' },
    retry,
    timeout,
  })

  if (error) {
    return {
      error,
    }
  }

  /** @type {import('./types.js').DoHResponse} */
  const result = await rawResult

  if (result.Status !== 0) {
    const desc = statusToDescription(result.Status)
    // eslint-disable-next-line no-nested-ternary
    const error = Array.isArray(result.Comment)
      ? `${desc} - ${result.Comment.join(' ').trim()}`
      : result.Comment
        ? `${desc} - ${result.Comment}`
        : desc

    const out = {
      error: new DohError(error, { data: result }),
    }
    const ttl = errorTtl(result)
    if (ttl !== undefined) {
      await cache.set([url], out, { ttl })
    }
    return out
  }

  // Answer can hold a CNAME/DNAME chain before the records of the requested type
  const answers = result.Answer ?? []
  const typeNumber = RECORD_TYPES[type] ?? result.Question?.[0]?.type
  const records = answers.filter((a) => a.type === typeNumber)
  // the result is only valid while every link of the chain is
  const chainTtl = Math.min(...answers.map((a) => a.TTL))
  const ttl =
    records.length > 0 ? chainTtl : Math.min(chainTtl, negativeTtl(result))

  const data = /** @type {T} */ (
    records.map((a) =>
      typeNumber === RECORD_TYPES.TXT ? parseTxt(a.data) : a.data
    )
  )
  const out = { result: data }
  await cache.set([url], out, { ttl })
  return out
}
