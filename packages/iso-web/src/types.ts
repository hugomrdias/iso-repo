/** biome-ignore-all lint/suspicious/noConfusingVoidType: its fine */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { RetryContext } from 'p-retry'
import type { Jsonifiable } from 'type-fest'

export type RequestInput = URL | string

export interface PollOptions {
  /**
   * The delay between polling attempts in milliseconds.
   *
   * @default 1000
   */
  interval?: number | ((context: PollContext) => number | Promise<number>)
  /**
   * The maximum number of pollable responses before returning the last response.
   *
   * @default 10
   */
  limit?: number
  /**
   * The HTTP status codes that should trigger polling.
   *
   * @default [202]
   */
  statusCodes?: number[]
  /**
   * Decide whether polling should continue after a pollable response.
   *
   * Returning false stops polling and returns the current response. Returning a
   * Response stops polling and returns that response instead.
   */
  shouldPoll?: (
    context: PollContext
  ) => boolean | Response | void | Promise<boolean | Response | void>
}

export interface PollContext {
  attempt: number
  response: Response
  request: Request
  options: RequestOptions
}

export interface RetryOptions {
  /**
   * The HTTP status codes to retry on.
   *
   * This includes both error status codes (4xx, 5xx) and success codes (2xx).
   * For example, you can retry on 202 (Accepted) to poll until a resource
   * is ready, or on 404 to wait for a resource to be created.
   *
   * @default [408, 413, 429, 500, 502, 503, 504]
   */
  statusCodes?: number[]
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
   * Called after built-in checks pass, before retrying. Return false to stop retrying.
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
  /**
   * Timeout in milliseconds for the request, `false` to disable timeout
   *
   * @default 5000
   */
  timeout?: number | false
  /**
   * Retry failed requests.
   *
   * Set to `true` to use the default retry options.
   *
   * @default false
   */
  retry?: RetryOptions | boolean
  /**
   * Poll responses that match the configured status codes.
   *
   * Set to `true` to use the default polling options.
   *
   * @default false
   */
  poll?: PollOptions | boolean
  json?: Jsonifiable
  onResponse?: (
    response: Response,
    request: Request
  ) => void | Response | Promise<Response | void>
}

export interface JSONRequestOptions<T = unknown> {
  fetch?: typeof globalThis.fetch
  redirect?: RequestRedirect
  body?: Jsonifiable | null
  method?: string
  headers?: HeadersInit
  signal?: AbortSignal
  keepalive?: boolean
  /**
   * Timeout in milliseconds for the request, `false` to disable timeout
   *
   * @default 5000
   */
  timeout?: number | false
  /**
   * Retry failed requests.
   *
   * Set to `true` to use the default retry options.
   *
   * @default false
   */
  retry?: RetryOptions | boolean
  /**
   * Poll responses that match the configured status codes.
   *
   * Set to `true` to use the default polling options.
   *
   * @default false
   */
  poll?: PollOptions | boolean
  schema?: StandardSchemaV1<unknown, T>
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
