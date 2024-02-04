import type { Options } from 'p-retry'
import type { IKV } from 'iso-kv'

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
   * Retry options
   *
   * By default retries are disabled
   *
   * @example
   * { retries: 5, factor: 2, minTimeout: 1000 }
   */
  retry?: Options

  cache?: IKV
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
