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
   * When `retry` is also enabled, the limit applies per retry attempt, not overall.
   * A retry restarts polling from the first request with a fresh counter, so the
   * worst case is `(retries + 1) × limit` requests. The default `timeout` is
   * sized for that worst case, and an explicit `timeout` covers all of them.
   *
   * @default 10
   */
  limit?: number
  /**
   * The HTTP status codes that should trigger polling.
   * Status codes in the range 200-299.
   *
   * @default [202]
   */
  statusCodes?: number[]
  /**
   * Decide whether to poll again. Called for every successful response, and
   * its return value replaces the built-in check (`statusCodes`).
   *
   * `context.defaultShouldPoll` holds the built-in decision, so return it to
   * keep the default behavior. Returning false stops polling and returns the
   * current response. `limit` still applies.
   *
   * @param context - The context of the poll
   * @returns - Whether to continue polling
   */
  shouldPoll?: (context: ShouldPollContext) => boolean | Promise<boolean>
}

export interface PollContext {
  /**
   * Zero-based index of the current poll within the current retry attempt.
   *
   * Resets to `0` on every retry when `retry` is also enabled.
   */
  attempt: number
  response: Response
  request: Request
  options: RequestOptions
}

export interface ShouldPollContext extends PollContext {
  /**
   * Whether the built-in check (`statusCodes`) would poll again.
   */
  defaultShouldPoll: boolean
}

export interface ShouldRetryContext extends RetryContext {
  /**
   * Whether the built-in checks would retry: the method is in `methods` and
   * the error is a network error or an HTTP error with a code in `statusCodes`.
   */
  defaultShouldRetry: boolean
}

export interface RetryOptions {
  /**
   * The HTTP status codes to retry on.
   * Status codes in the range 400-599.
   *
   * @default [408, 413, 429, 500, 502, 503, 504]
   */
  statusCodes?: number[]
  /**
   * The status codes to retry after
   *
   * Request will wait until the date or number of seconds given in the Retry-After header has passed to retry the request. If Retry-After is missing, the non-standard RateLimit-Reset header (seconds) is used in its place as a fallback, then X-RateLimit-Reset or X-Rate-Limit-Reset (Unix timestamp in seconds). If the provided status code is not in the list, the Retry-After header will be ignored.
   *
   * The wait only happens when the request will be retried, and it replaces the backoff delay. If the wait doesn't fit in the remaining `timeout` or `maxRetryTime`, the `HttpError` is returned right away. Retries after a Retry-After wait count against `retries`.
   *
   * @default [413, 429, 503]
   */
  afterStatusCodes?: number[]

  /**
   * The methods to retry. Both `statusCodes` and network errors are only
   * retried for these methods, so non-idempotent methods like `POST` and
   * `PATCH` are not retried unless added here or allowed by `shouldRetry`.
   *
   * @default ['get', 'put', 'head', 'delete', 'options', 'trace']
   */
  methods?: string[]

  /**
   * Decide whether to retry a failed attempt. Called for every failure while
   * retries are left, and its return value replaces the built-in checks
   * (`methods`, `statusCodes` and network errors).
   *
   * `context.defaultShouldRetry` holds the built-in decision, so return it to
   * keep the default behavior. Return true to retry requests the built-in
   * checks would not, for example an idempotent `POST`. `retries` and
   * `maxRetryTime` still apply.
   *
   * When the request is retried, the body of the failed response is cancelled
   * after this hook returns. Read it inside the hook, or clone it to keep it.
   *
   * @param context - The context of the retry
   * @returns - Whether to retry the request
   */
  shouldRetry?: (context: ShouldRetryContext) => boolean | Promise<boolean>

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
   *
   * When `poll` is also enabled, each retry reruns the whole polling loop and
   * restarts its counter, so up to `(retries + 1) × poll.limit` requests can be made.
   * The default `timeout` is sized for that worst case.
   * @default 2
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
   * Total time budget in milliseconds for the request, including every retry,
   * poll and the delays between them. `false` disables the timeout.
   *
   * Without `retry` or `poll` the default is 5000. With them, the default is
   * 5000 for each attempt they allow plus the retry backoff and poll intervals
   * (59000 for `poll: true`, 18000 for `retry: true`). A function `interval`
   * counts as 1000. There is no default timeout when that budget is unbounded,
   * for example `retries: Infinity`.
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
   * When combined with `retry`, a retryable failure during polling retries the
   * whole polling loop, which starts again from the first poll. `poll.limit`
   * applies per retry.
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
   * Total time budget in milliseconds for the request, including every retry,
   * poll and the delays between them. `false` disables the timeout.
   *
   * Without `retry` or `poll` the default is 5000. With them, the default is
   * 5000 for each attempt they allow plus the retry backoff and poll intervals
   * (59000 for `poll: true`, 18000 for `retry: true`). A function `interval`
   * counts as 1000. There is no default timeout when that budget is unbounded,
   * for example `retries: Infinity`.
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
   * When combined with `retry`, a retryable failure during polling retries the
   * whole polling loop, which starts again from the first poll. `poll.limit`
   * applies per retry.
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
