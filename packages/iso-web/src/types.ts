/** biome-ignore-all lint/suspicious/noConfusingVoidType: its fine */
import type { Jsonifiable } from 'type-fest'

export type RequestInput = URL | string

export interface RetryOptions {
  afterStatusCodes?: number[]
  methods?: string[]
  /**
   * Whether to retry forever.
   * @default false
   */
  forever?: boolean | undefined
  /**
   * Whether to [unref](https://nodejs.org/api/timers.html#timers_unref) the setTimeout's.
   * @default false
   */
  unref?: boolean | undefined
  /**
   * The maximum time (in milliseconds) that the retried operation is allowed to run.
   * @default Infinity
   */
  maxRetryTime?: number | undefined
  /**
   * The maximum amount of times to retry the operation.
   * @default 10
   */
  retries?: number | undefined
  /**
   * The exponential factor to use.
   * @default 2
   */
  factor?: number | undefined
  /**
   * The number of milliseconds before starting the first retry.
   * @default 1000
   */
  minTimeout?: number | undefined
  /**
   * The maximum number of milliseconds between two retries.
   * @default Infinity
   */
  maxTimeout?: number | undefined
  /**
   * Randomizes the timeouts by multiplying a factor between 1-2.
   * @default false
   */
  randomize?: boolean | undefined
}

export interface RequestOptions {
  fetch?: typeof globalThis.fetch
  redirect?: RequestRedirect
  body?: BodyInit | null
  method?: string
  headers?: HeadersInit
  signal?: AbortSignal
  keepalive?: boolean
  timeout?: number
  retry?: RetryOptions
  json?: Jsonifiable
  onResponse?: (
    response: Response,
    request: Request
  ) => void | Response | Promise<Response | void>
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
  retry?: RetryOptions
  onResponse?: (
    response: Response,
    request: Request
  ) => void | Response | Promise<Response | void>
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
