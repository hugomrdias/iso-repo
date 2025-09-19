/** biome-ignore-all lint/suspicious/noConfusingVoidType: its fine */
import type { RetryContext } from 'p-retry'
import type { Jsonifiable } from 'type-fest'

export type RequestInput = URL | string

export interface RetryOptions {
  /**
   * The status codes to retry after
   *
   * Request will wait until the date, timeout, or timestamp given in the Retry-After header has passed to retry the request. If Retry-After is missing, the non-standard RateLimit-Reset header is used in its place as a fallback. If the provided status code is not in the list, the Retry-After header will be ignored.
   *
   * @default [413, 429, 503]
   */
  afterStatusCodes?: number[]

  /**
   * The methods to retry
   *
   * @default ['get', 'put', 'head', 'delete', 'options', 'trace']
   */
  methods?: string[]

  /**
   * Decide if a retry should occur based on the context. Returning true triggers a retry, false aborts with the error.
   *
   * It is only called if `retries` and `maxRetryTime` have not been exhausted.
   *
   * It is not called for `TypeError` (except network errors) and `AbortError`.
   *
   * @param context - The context of the retry
   * @returns - Whether to retry the request
   */
  shouldRetry?: (context: RetryContext) => boolean | Promise<boolean>

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
