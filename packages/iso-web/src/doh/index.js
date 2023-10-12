import { KV } from 'iso-kv'
import { request } from '../http.js'

const symbol = Symbol.for('doh-error')

/**
 * @typedef {import('../http.js').Errors | DohError} Errors
 * @typedef {import('../http.js').Errors} RequestErrors
 */

export {
  AbortError,
  HttpError,
  NetworkError,
  RequestError,
  RetryError,
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

const kv = new KV()
/**
 * Resolve a DNS query using DNS over HTTPS
 *
 * @see https://developers.google.com/speed/public-dns/docs/doh/json
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
 *
 * @param {string} query
 * @param {import("./types.js").RecordType} type
 * @param {import("./types.js").ResolveOptions} [options]
 * @returns {Promise<import("../types.js").MaybeResult<string[], Errors>>}
 */
export async function resolve(query, type, options = {}) {
  const { cache = kv } = options
  const {
    server = 'https://cloudflare-dns.com/dns-query',
    signal,
    retry,
    timeout,
  } = options
  const url = `${server}?name=${query}&type=${type}`

  /** @type {import('../types.js').MaybeResult<string[], Errors> | undefined} */
  const cached = await cache.get([url])
  if (cached) {
    return cached
  }

  /** @type {import('../types.js').MaybeResult<import('./types.js').DoHResponse, RequestErrors>} */
  const { error, result } = await request(new URL(url).toString(), {
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

  if (result.Status !== 0) {
    const desc = statusToDescription(result.Status)
    // eslint-disable-next-line no-nested-ternary
    const error = Array.isArray(result.Comment)
      ? desc + ' - ' + result.Comment.join(' ').trim()
      : result.Comment
      ? desc + ' - ' + result.Comment
      : desc

    const out = {
      error: new DohError(error, { data: result }),
    }
    await cache.set([url], out, 3600) // caches errors for 1 hour
    return out
  }

  if (result.Answer) {
    const data = result.Answer.map((a) => a.data.replaceAll(/["']+/g, ''))
    const ttl = Math.min(...result.Answer.map((a) => a.TTL))
    const out = { result: data }
    await cache.set([url], out, ttl)
    return out
  }

  if (result.Authority) {
    const data = result.Authority.map((a) => a.data)
    const ttl = Math.min(...result.Authority.map((a) => a.TTL))
    const out = { result: data }
    await cache.set([url], out, ttl)
    return out
  }

  return {
    error: new DohError('No answer or authority', { data: result }),
  }
}
