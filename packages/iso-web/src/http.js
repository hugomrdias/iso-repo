import delay from 'delay'
import isNetworkError from 'is-network-error'
import pRetry from 'p-retry'

import { anySignal } from './signals.js'

const symbol = Symbol.for('request-error')

/**
 * @typedef {RequestError | NetworkError | TimeoutError | AbortError | HttpError } RequestErrors
 * @typedef {RequestErrors | JsonError | SchemaError} RequestJsonErrors
 */

/**
 * Check if a value is a RequestError
 *
 * @param {unknown} value
 * @returns {value is RequestError}
 */
export function isRequestError(value) {
  return value instanceof Error && symbol in value
}

export class RequestError extends Error {
  /** @type {boolean} */
  [symbol] = true

  name = 'RequestError'

  /** @type {unknown} */
  cause

  /**
   *
   * @param {string} message
   * @param {ErrorOptions} [options]
   */
  constructor(message, options = {}) {
    super(message, options)

    this.cause = options.cause
  }

  /**
   * Check if a value is a RequestError
   *
   * @param {unknown} value
   * @returns {value is RequestError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'RequestError'
  }
}

export class JsonError extends RequestError {
  name = 'JsonError'

  /** @type {import('type-fest').JsonValue} */
  cause

  /** @type {number} */
  code = 0

  /** @type {Response} */
  response

  /** @type {Request} */
  request

  /**
   *
   * @param {{ cause: import('type-fest').JsonValue, response: Response, request: Request }} options
   */
  constructor(options) {
    super('Failed with a JSON error, see cause.', { cause: options.cause })

    this.cause = options.cause
    this.code = options.response.status
    this.response = options.response
    this.request = options.request
  }

  /**
   * Check if a value is a JsonError
   *
   * @param {unknown} value
   * @returns {value is JsonError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'JsonError'
  }
}

export class NetworkError extends RequestError {
  name = 'NetworkError'

  /**
   *
   * @param {ErrorOptions} options
   */
  constructor(options = {}) {
    super('Network request failed', options)
  }

  /**
   * Check if a value is a NetworkError
   *
   * @param {unknown} value
   * @returns {value is NetworkError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'NetworkError'
  }
}

export class TimeoutError extends RequestError {
  name = 'TimeoutError'
  /**
   *
   * @param {number} timeout
   * @param {ErrorOptions} [options]
   */
  constructor(timeout, options = {}) {
    super(`Request timed out after ${timeout}ms`, options)
  }

  /**
   * Check if a value is a TimeoutError
   *
   * @param {unknown} value
   * @returns {value is TimeoutError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'TimeoutError'
  }
}

export class AbortError extends RequestError {
  name = 'AbortError'

  /** @type {AbortSignal} */
  signal
  /**
   *
   * @param {AbortSignal} signal
   * @param {ErrorOptions} [options]
   */
  constructor(signal, options = {}) {
    super(`Request aborted: ${signal.reason ?? 'unknown'}`, options)
    this.signal = signal
  }

  /**
   * Check if a value is a AbortError
   *
   * @param {unknown} value
   * @returns {value is AbortError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'AbortError'
  }
}

export class HttpError extends RequestError {
  name = 'HttpError'

  /** @type {number} */
  code = 0

  /** @type {Response} */
  response

  /** @type {Request} */
  request

  /** @type {import('./types.js').RequestOptions} */
  options

  /**
   *
   * @param {ErrorOptions & {response: Response, request: Request, options: import('./types.js').RequestOptions}} options
   */
  constructor(options) {
    super(`${options.response.status} - ${options.response.statusText}`, {
      cause: options.cause,
    })

    this.code = options.response.status
    this.response = options.response
    this.request = options.request
    this.options = options.options
  }

  /**
   * Check if a value is a HttpError
   *
   * @param {unknown} value
   * @returns {value is HttpError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'HttpError'
  }
}

export class SchemaError extends RequestError {
  name = 'SchemaError'

  /** @type {Response} */
  response

  /** @type {ReadonlyArray<import('@standard-schema/spec').StandardSchemaV1.Issue>} */
  issues

  /**
   *
   * @param {ErrorOptions & {response: Response, issues: ReadonlyArray<import('@standard-schema/spec').StandardSchemaV1.Issue>}} options
   */
  constructor(options) {
    super('Schema validation failed', options)

    this.issues = options.issues
    this.response = options.response
  }

  /**
   * Check if a value is a SchemaError
   *
   * @param {unknown} value
   * @returns {value is SchemaError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'SchemaError'
  }
}

const DEFAULT_RETRY_STATUS_CODES = [408, 413, 429, 500, 502, 503, 504]
const DEFAULT_RETRY_AFTER_STATUS_CODES = [413, 429, 503]
const DEFAULT_RETRY_METHODS = [
  'get',
  'put',
  'head',
  'delete',
  'options',
  'trace',
]
const DEFAULT_POLL_STATUS_CODES = [202]
const DEFAULT_POLL_INTERVAL = 1000
const DEFAULT_POLL_LIMIT = 10
const DEFAULT_ATTEMPT_TIMEOUT = 5000
// the largest delay browsers' timers accept
const MAX_TIMEOUT = 2 ** 31 - 1

/**
 * Total time budget when `timeout` isn't set: 5000ms for each attempt the
 * retry and poll options allow, plus the retry backoff and poll intervals
 * between them.
 *
 * A function `interval` is counted as the default interval. Returns `false`
 * (no timeout) when the budget is unbounded or too large for a timer.
 *
 * @param {import('./types.js').RetryOptions | undefined} retryOptions
 * @param {import('./types.js').PollOptions | undefined} pollOptions
 * @returns {number | false}
 */
function defaultTimeout(retryOptions, pollOptions) {
  const limit = pollOptions
    ? Math.max(1, pollOptions.limit ?? DEFAULT_POLL_LIMIT)
    : 1
  const interval =
    typeof pollOptions?.interval === 'number'
      ? pollOptions.interval
      : DEFAULT_POLL_INTERVAL
  const pollTime =
    limit * DEFAULT_ATTEMPT_TIMEOUT +
    (pollOptions ? (limit - 1) * Math.max(0, interval) : 0)

  let total = pollTime
  if (retryOptions != null) {
    const retries = retryOptions.retries ?? 2
    const factor =
      (retryOptions.factor ?? 2) > 0 ? (retryOptions.factor ?? 2) : 1
    const minTimeout = retryOptions.minTimeout ?? 1000
    const maxTimeout = retryOptions.maxTimeout ?? Number.POSITIVE_INFINITY
    const random = retryOptions.randomize ? 2 : 1

    for (let retry = 0; retry < retries && total <= MAX_TIMEOUT; retry++) {
      total +=
        Math.min(random * minTimeout * factor ** retry, maxTimeout) + pollTime
    }
  }

  // invalid numbers are reported by the retry and poll code, not the timer
  if (Number.isNaN(total)) {
    return DEFAULT_ATTEMPT_TIMEOUT
  }

  return total <= MAX_TIMEOUT ? Math.ceil(total) : false
}

/**
 * HTTP Request
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
export async function request(resource, options = {}) {
  try {
    return await send(resource, options)
  } catch (error) {
    // option handling and `new Request` throw before `send` can catch anything
    return { error: toRequestError(error) }
  }
}

/**
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
async function send(resource, options) {
  const {
    signal,
    retry,
    poll,
    fetch = globalThis.fetch.bind(globalThis),
    json,
    headers,
    onResponse,
  } = options

  const retryOptions = normalizeRetryOptions(retry)
  const retryStatusCodes =
    retryOptions?.statusCodes ?? DEFAULT_RETRY_STATUS_CODES
  const retryMethods = retryOptions?.methods
    ? retryOptions.methods.map((method) => method.toLowerCase())
    : DEFAULT_RETRY_METHODS
  const pollOptions = normalizePollOptions(poll)
  const pollStatusCodes = pollOptions?.statusCodes ?? DEFAULT_POLL_STATUS_CODES
  const timeout = options.timeout ?? defaultTimeout(retryOptions, pollOptions)

  // validate resource type
  if (typeof resource !== 'string' && !(resource instanceof URL)) {
    return {
      error: new RequestError('`resource` must be a string or URL object'),
    }
  }

  // timeout signal
  const start = performance.now()
  const timeoutSignal =
    timeout === false ? undefined : AbortSignal.timeout(timeout)
  const combinedSignals = anySignal([signal, timeoutSignal])

  // headers
  const _headers = new Headers(headers)
  let body = options.body
  if (json !== undefined) {
    _headers.set(
      'content-type',
      _headers.get('content-type') ?? 'application/json'
    )
    body = JSON.stringify(json)
  }

  // request
  const request = new Request(resource, {
    ...options,
    body,
    headers: _headers,
    signal: combinedSignals,
  })

  async function fn() {
    const req =
      retryOptions == null && pollOptions == null ? request : request.clone()
    let rsp = await fetch(req)

    if (onResponse) {
      let result
      try {
        // cloning tees the body, so only clone when a hook will read it
        result = await onResponse(rsp.clone(), request)
      } catch (error) {
        discard(rsp)
        throw error
      }

      if (result instanceof Response) {
        rsp = result
      }
    }

    if (!rsp.ok) {
      throw new HttpError({
        response: rsp,
        request: req,
        options,
      })
    }
    return rsp
  }

  /**
   * Repeat the request while the response has a pollable status code.
   *
   * @returns {Promise<Response>}
   */
  async function pollRequest() {
    let attempt = 0

    while (true) {
      const response = await fn()
      const defaultShouldPoll = pollStatusCodes.includes(response.status)
      let shouldPoll = defaultShouldPoll

      const currentAttempt = attempt
      if (pollOptions?.shouldPoll) {
        shouldPoll = await pollOptions.shouldPoll({
          ...createPollContext(response, attempt),
          defaultShouldPoll,
        })
      }

      if (!shouldPoll) {
        return response
      }

      attempt++

      if (attempt >= (pollOptions?.limit ?? DEFAULT_POLL_LIMIT)) {
        return response
      }

      const interval = await resolvePollInterval(pollOptions?.interval, () =>
        createPollContext(response, currentAttempt)
      )

      discard(response)
      await delay(interval, { signal: combinedSignals })
    }
  }

  /**
   * Create the context passed to polling hooks.
   *
   * @param {Response} response
   * @param {number} attempt
   * @returns {import('./types.js').PollContext}
   */
  function createPollContext(response, attempt) {
    return {
      attempt,
      response: response.clone(),
      request,
      options,
    }
  }

  /**
   * Retry `operation` with p-retry, waiting for Retry-After instead of the
   * backoff delay.
   *
   * p-retry has no per-attempt delay, so a Retry-After attempt tells p-retry
   * not to consume a retry (which skips its backoff) and `shouldRetry` waits
   * instead, once it knows a retry will happen. Those retries are counted
   * here so they still count against `retries`.
   *
   * @param {import('./types.js').RetryOptions} retryOptions
   * @param {() => Promise<Response>} operation
   */
  function retryRequest(retryOptions, operation) {
    const retries = retryOptions.retries ?? 2
    const maxRetryTime = retryOptions.maxRetryTime ?? Number.POSITIVE_INFINITY
    const afterStatusCodes =
      retryOptions.afterStatusCodes ?? DEFAULT_RETRY_AFTER_STATUS_CODES
    const deadline = Math.min(
      timeout === false ? Number.POSITIVE_INFINITY : start + timeout,
      performance.now() + maxRetryTime
    )
    let retryAfterRetries = 0
    let retryAfter = 0

    return pRetry(() => operation(), {
      retries,
      factor: retryOptions.factor ?? 2,
      minTimeout: retryOptions.minTimeout ?? 1000,
      maxTimeout: retryOptions.maxTimeout ?? Number.POSITIVE_INFINITY,
      randomize: retryOptions.randomize ?? false,
      unref: retryOptions.unref ?? false,
      maxRetryTime,
      signal: combinedSignals,
      shouldConsumeRetry: (ctx) => {
        retryAfter =
          HttpError.is(ctx.error) && afterStatusCodes.includes(ctx.error.code)
            ? calculateRetryAfter(ctx.error.response)
            : 0
        return !(retryAfter > 0)
      },
      shouldRetry: async (ctx) => {
        const retriesConsumed = ctx.retriesConsumed + retryAfterRetries
        if (retriesConsumed >= retries) {
          return false
        }

        const defaultShouldRetry =
          retryMethods.includes(request.method.toLowerCase()) &&
          ((HttpError.is(ctx.error) &&
            retryStatusCodes.includes(ctx.error.code)) ||
            isNetworkError(ctx.error))

        const shouldRetry = retryOptions.shouldRetry
          ? Boolean(
              await retryOptions.shouldRetry({
                ...ctx,
                retriesConsumed,
                retriesLeft: retries - retriesConsumed,
                retryDelay: retryAfter > 0 ? retryAfter : ctx.retryDelay,
                defaultShouldRetry,
              })
            )
          : defaultShouldRetry

        if (!shouldRetry) {
          return false
        }

        const wait = retryAfter > 0 ? retryAfter : 0
        // checked before discarding, since this error is returned if it doesn't fit
        if (performance.now() + wait > deadline) {
          return false
        }

        if (HttpError.is(ctx.error)) {
          discard(ctx.error.response)
        }

        if (wait > 0) {
          await delay(wait, { signal: combinedSignals })
          retryAfterRetries++
        }
        return true
      },
    })
  }

  try {
    const operation = pollOptions == null ? fn : pollRequest
    const response = await (retryOptions
      ? retryRequest(retryOptions, operation)
      : operation())

    return { result: response }
  } catch (error) {
    const err = /** @type {Error} */ (error)

    if (timeout !== false && timeoutSignal?.aborted) {
      return { error: new TimeoutError(timeout, { cause: err }) }
    }

    if (signal?.aborted) {
      return { error: new AbortError(signal, { cause: err }) }
    }

    if (HttpError.is(err)) {
      return {
        error: err,
      }
    }

    if (isNetworkError(err)) {
      return {
        error: new NetworkError({ cause: err }),
      }
    }

    return {
      error: toRequestError(err),
    }
  }
}

/**
 * Wrap an error that isn't an HTTP, network, timeout or abort failure.
 *
 * @param {unknown} error
 */
function toRequestError(error) {
  const message = error instanceof Error ? error.message : String(error)
  return new RequestError(`Request failed: ${message}`, { cause: error })
}

/**
 * Cancel the body of a response that won't be returned, so the connection
 * is released without waiting for garbage collection. Clones handed to hooks
 * are separate branches and stay readable.
 *
 * @param {Response} response
 */
function discard(response) {
  response.body?.cancel().catch(() => {
    // already read or locked by a hook
  })
}

/**
 *
 * @param {Response} response
 */
function calculateRetryAfter(response) {
  const retryAfter =
    response.headers.get('Retry-After') ??
    response.headers.get('RateLimit-Reset')

  if (retryAfter === null) {
    // Unix timestamp in seconds
    const reset =
      response.headers.get('X-RateLimit-Reset') ?? // github
      response.headers.get('X-Rate-Limit-Reset') // twitter

    return reset === null ? 0 : Number(reset.trim()) * 1000 - Date.now()
  }

  let after = Number(retryAfter.trim())
  if (Number.isNaN(after)) {
    // is a date string
    after = Date.parse(retryAfter) - Date.now()
  } else {
    // is a number of seconds
    after *= 1000
  }

  return after
}

/**
 * Normalize boolean retry options into the internal options shape.
 *
 * @param {import('./types.js').RequestOptions['retry']} retry
 * @returns {import('./types.js').RetryOptions | undefined}
 */
function normalizeRetryOptions(retry) {
  if (retry === true) {
    return {}
  }

  if (retry === false) {
    return undefined
  }

  return retry
}

/**
 * Normalize boolean polling options into the internal options shape.
 *
 * @param {import('./types.js').RequestOptions['poll']} poll
 * @returns {import('./types.js').PollOptions | undefined}
 */
function normalizePollOptions(poll) {
  if (poll === true) {
    return {}
  }

  if (poll === false) {
    return undefined
  }

  return poll
}

/**
 * Resolve the delay before the next poll attempt.
 *
 * @param {import('./types.js').PollOptions['interval']} interval
 * @param {() => import('./types.js').PollContext} createContext
 * @returns {number | Promise<number>}
 */
function resolvePollInterval(interval, createContext) {
  if (typeof interval === 'function') {
    return interval(createContext())
  }

  return interval ?? DEFAULT_POLL_INTERVAL
}

/**
 * Request GET
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.get = function get(resource, options = {}) {
  return request(resource, { ...options, method: 'GET' })
}

/**
 * Request POST
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.post = function post(resource, options = {}) {
  return request(resource, { ...options, method: 'POST' })
}

/**
 * Request PUT
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.put = function put(resource, options = {}) {
  return request(resource, { ...options, method: 'PUT' })
}

/**
 * Request DELETE
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.delete = function del(resource, options = {}) {
  return request(resource, { ...options, method: 'DELETE' })
}

/**
 * Request PATCH
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.patch = function patch(resource, options = {}) {
  return request(resource, { ...options, method: 'PATCH' })
}

/**
 * Request HEAD
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.head = function head(resource, options = {}) {
  return request(resource, { ...options, method: 'HEAD' })
}

/**
 * Request OPTIONS
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.options = function optionsFn(resource, options = {}) {
  return request(resource, { ...options, method: 'OPTIONS' })
}

/**
 * Request TRACE
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
request.trace = function trace(resource, options = {}) {
  return request(resource, { ...options, method: 'TRACE' })
}

/**
 * Request Json GET
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json = async function json(resource, options = {}) {
  const { error, result } = await request(resource, {
    ...options,
    body: null,
    json: options.body,
  })

  if (error) {
    if (
      HttpError.is(error) &&
      error.response.headers.get('content-type')?.includes('json')
    ) {
      const response = error.response.clone()
      const body = await parseJson(error.response)
      if (body.error) {
        return body
      }
      return {
        error: new JsonError({
          cause: body.result,
          response,
          request: error.request,
        }),
      }
    }
    return { error }
  }

  if (result.ok && result.headers.get('content-type')?.includes('json')) {
    const schema = options.schema

    if (schema) {
      const response = result.clone()
      const value = await parseJson(result)
      if (value.error) {
        return value
      }

      let validation
      try {
        validation = await schema['~standard'].validate(value.result)
      } catch (error) {
        return { error: toRequestError(error) }
      }

      if (validation.issues) {
        return {
          error: new SchemaError({
            response,
            issues: validation.issues,
          }),
        }
      }

      return { result: /** @type {T} */ (validation.value) }
    }

    const value = await parseJson(result)
    if (value.error) {
      return value
    }

    return { result: /** @type {T} */ (value.result) }
  }

  return {
    error: new RequestError('Response is not JSON', { cause: result }),
  }
}

/**
 * Parse a JSON body without rejecting.
 *
 * @param {Response} response
 * @returns {Promise<import("./types.js").MaybeResult<import('type-fest').JsonValue, RequestError>>}
 */
async function parseJson(response) {
  try {
    return { result: await response.json() }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        error: new RequestError('Response body is not valid JSON', {
          cause: error,
        }),
      }
    }
    return { error: toRequestError(error) }
  }
}

/**
 * Request Json GET
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.get = function get(resource, options = {}) {
  return request.json(resource, { ...options, method: 'GET' })
}

/**
 * Request Json POST
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.post = function post(resource, options = {}) {
  return request.json(resource, { ...options, method: 'POST' })
}

/**
 * Request Json PUT
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.put = function put(resource, options = {}) {
  return request.json(resource, { ...options, method: 'PUT' })
}

/**
 * Request Json DELETE
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.delete = function del(resource, options = {}) {
  return request.json(resource, { ...options, method: 'DELETE' })
}

/**
 * Request Json PATCH
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.patch = function patch(resource, options = {}) {
  return request.json(resource, { ...options, method: 'PATCH' })
}

/**
 * Request Json OPTIONS
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.options = function optionsFn(resource, options = {}) {
  return request.json(resource, { ...options, method: 'OPTIONS' })
}

/**
 * Request Json TRACE
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.trace = function trace(resource, options = {}) {
  return request.json(resource, { ...options, method: 'TRACE' })
}
