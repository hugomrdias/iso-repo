import type { RetryOptions } from '../types'

export type RecordType =
  | 'A'
  | 'AAAA'
  | 'CAA'
  | 'CNAME'
  | 'MX'
  | 'NAPTR'
  | 'NS'
  | 'PTR'
  | 'SOA'
  | 'SRV'
  | 'TXT'

export interface ResolveOptions {
  /**
   * DoH server JSON endpoint URL
   *
   * @see https://dnscrypt.info/public-servers
   *
   * @example
   * https://cloudflare-dns.com/dns-query
   * https://dns.google/resolve
   */
  server?: string
  /**
   * Abort signal to abort the request
   */
  signal?: AbortSignal
  /**
   * Timeout in milliseconds for the request
   *
   * Defaults to 5000
   */
  timeout?: number
  /**
   * Retry failed requests.
   *
   * Set to `true` to use the default retry options.
   *
   * @default false
   */
  retry?: RetryOptions | boolean
  /**
   * Cache for DoH results
   *
   * Defaults to a shared in-memory `LRUCache` from `iso-web/lru` with 1000 entries.
   */
  cache?: DohCache
}

/**
 * Cache used by `resolve()`
 *
 * `KV` instances from `iso-kv` satisfy this interface.
 */
export interface DohCache {
  get: (key: string[]) => unknown
  /**
   * @param options.ttl - Time-to-live in seconds
   */
  set: (key: string[], value: unknown, options: { ttl: number }) => unknown
}

export interface Answer {
  name: string
  type: number
  data: string
  TTL: number
}

export interface DoHResponse {
  /**
   * Status code of the response
   *
   * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6
   */
  Status: number
  Question: Array<{ name: string; type: number }>
  Authority?: Answer[]
  Answer?: Answer[]
  Comment?: string | string[]
}
