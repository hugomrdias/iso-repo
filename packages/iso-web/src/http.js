import delay from 'delay'
import isNetworkError from 'is-network-error'
import pRetry from 'p-retry'

import { anySignal } from './signals.js'

const symbol = Symbol.for('request-error')

/**
 * @typedef {NetworkError | TimeoutError | AbortError | HttpError } RequestErrors
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

  /**
   *
   * @param {{ cause: import('type-fest').JsonValue }} options
   */
  constructor(options) {
    super('Failed with a JSON error, see cause.', options)

    this.cause = options.cause
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
    const msg = `${options.response.status} - ${options.response.statusText}`

    super(msg)

    this.code = options.response?.status ?? 0
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

/**
 * HTTP Request
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, RequestErrors>>}
 */
export async function request(resource, options = {}) {
  const {
    signal,
    timeout = 5000,
    retry,
    poll,
    fetch = globalThis.fetch.bind(globalThis),
    json,
    headers,
    onResponse = () => {
      // noop
    },
  } = options

  const retryOptions = normalizeRetryOptions(retry)
  const retryStatusCodes =
    retryOptions?.statusCodes ?? DEFAULT_RETRY_STATUS_CODES
  const retryMethods = retryOptions?.methods
    ? retryOptions.methods.map((method) => method.toLowerCase())
    : DEFAULT_RETRY_METHODS
  const pollOptions = normalizePollOptions(poll)
  const pollStatusCodes = pollOptions?.statusCodes ?? DEFAULT_POLL_STATUS_CODES

  // validate resource type
  if (typeof resource !== 'string' && !(resource instanceof URL)) {
    return {
      error: new RequestError('`resource` must be a string or URL object'),
    }
  }

  // timeout signal
  const timeoutSignal =
    timeout === false ? undefined : AbortSignal.timeout(timeout)
  const combinedSignals = anySignal([signal, timeoutSignal])

  // headers
  const _headers = new Headers(headers)
  if (json !== undefined) {
    _headers.set(
      'content-type',
      _headers.get('content-type') ?? 'application/json'
    )
    options.body = JSON.stringify(json)
  }

  // request
  const request = new Request(resource, {
    ...options,
    headers: _headers,
    signal: combinedSignals,
  })

  async function fn() {
    const req =
      retryOptions == null && pollOptions == null ? request : request.clone()
    let rsp = await fetch(req)

    const result = await onResponse(rsp.clone(), request)

    if (result instanceof Response) {
      rsp = result
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
      let shouldPoll = pollOptions != null

      if (!pollStatusCodes.includes(response.status)) {
        shouldPoll = false
      }

      const currentAttempt = attempt
      if (pollOptions?.shouldPoll) {
        shouldPoll = await pollOptions.shouldPoll(
          createPollContext(response, attempt)
        )
      }

      if (!shouldPoll) {
        return response
      }

      attempt++

      if (attempt >= (pollOptions?.limit ?? DEFAULT_POLL_LIMIT)) {
        return response
      }

      const interval = await resolvePollInterval(
        pollOptions?.interval,
        createPollContext(response, currentAttempt)
      )

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

  try {
    const operation = pollOptions == null ? fn : pollRequest
    const response = await (retryOptions
      ? pRetry(() => operation(), {
          retries: retryOptions.retries ?? 2,
          factor: retryOptions.factor ?? 2,
          minTimeout: retryOptions.minTimeout ?? 1000,
          maxTimeout: retryOptions.maxTimeout ?? Number.POSITIVE_INFINITY,
          randomize: retryOptions.randomize ?? false,
          unref: retryOptions.unref ?? false,
          maxRetryTime: retryOptions.maxRetryTime ?? Number.POSITIVE_INFINITY,
          signal: combinedSignals,
          onFailedAttempt: async (ctx) => {
            const codes =
              retryOptions.afterStatusCodes ?? DEFAULT_RETRY_AFTER_STATUS_CODES
            if (HttpError.is(ctx.error) && codes.includes(ctx.error.code)) {
              // Delay if needed using Retry-After header
              const delayValue = calculateRetryAfter(ctx.error.response)
              if (delayValue > 0) {
                await delay(delayValue, { signal: combinedSignals })
              }
            }
          },
          shouldRetry: async (ctx) => {
            let shouldRetry = false
            if (
              retryMethods.includes(request.method.toLowerCase()) &&
              HttpError.is(ctx.error) &&
              retryStatusCodes.includes(ctx.error.code)
            ) {
              shouldRetry = true
            }

            if (isNetworkError(ctx.error)) {
              shouldRetry = true
            }

            if (retryOptions.shouldRetry) {
              const result = await retryOptions.shouldRetry(ctx)
              shouldRetry = Boolean(result)
            }

            return shouldRetry
          },
        })
      : operation())

    return response.ok
      ? { result: response }
      : {
          error: new HttpError({
            response,
            request,
            options,
          }),
        }
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

    return {
      error: new NetworkError({ cause: err.cause }),
    }
  }
}

/**
 *
 * @param {Response} response
 */
function calculateRetryAfter(response) {
  const retryAfter =
    response.headers.get('Retry-After') ??
    response.headers.get('RateLimit-Reset') ??
    response.headers.get('X-RateLimit-Reset') ?? // github
    response.headers.get('X-Rate-Limit-Reset') // twitter

  if (retryAfter === null) {
    return 0
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
 * @param {import('./types.js').PollContext} context
 * @returns {number | Promise<number>}
 */
function resolvePollInterval(interval, context) {
  if (typeof interval === 'function') {
    return interval(context)
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
      return {
        error: new JsonError({ cause: await error.response.json() }),
      }
    }
    return { error }
  }

  if (result.ok && result.headers.get('content-type')?.includes('json')) {
    const schema = options.schema

    if (schema) {
      const response = result.clone()
      const value = await result.json()
      const validation = await schema['~standard'].validate(value)

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

    const value = await result.json()

    return { result: /** @type {T} */ (value) }
  }

  return {
    error: new RequestError('Response is not JSON', { cause: result }),
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
 * Request Json HEAD
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions<T>} options
 * @returns {Promise<import("./types.js").MaybeResult<T, RequestJsonErrors>>}
 */
request.json.head = function head(resource, options = {}) {
  return request.json(resource, { ...options, method: 'HEAD' })
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
