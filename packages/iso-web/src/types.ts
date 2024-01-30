import type { Options } from 'p-retry'
import type { Jsonifiable } from 'type-fest'

export type RequestInput = URL | string

export interface RequestOptions {
  fetch?: typeof globalThis.fetch
  redirect?: RequestRedirect
  body?: BodyInit | null
  method?: string
  headers?: HeadersInit
  signal?: AbortSignal
  keepalive?: boolean
  timeout?: number
  retry?: Options
  json?: Jsonifiable
}

export interface JSONRequestOptions {
  fetch?: typeof globalThis.fetch
  redirect?: RequestRedirect
  body?: Jsonifiable | null
  method?: string
  headers?: HeadersInit
  signal?: AbortSignal
  keepalive?: boolean
  timeout?: number
  retry?: Options
}

/**
 * Generic result with error
 */
export type MaybeResult<ResultType = unknown, ErrorType = Error> =
  | {
      error: ErrorType
      result?: undefined
    }
  | {
      result: ResultType
      error?: undefined
    }
