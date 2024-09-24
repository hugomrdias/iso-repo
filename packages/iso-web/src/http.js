import delay from 'delay'
import pRetry from 'p-retry'
import { anySignal } from './signals.js'

const symbol = Symbol.for('request-error')

/**
 * @typedef {NetworkError | TimeoutError | AbortError | HttpError | RetryError} Errors
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

export class RetryError extends RequestError {
  name = 'RetryError'

  /**
   *
   * @param {number} attempts
   * @param {ErrorOptions} [options]
   */
  constructor(attempts, options = {}) {
    super(`Request failed after ${attempts} attempts`, options)
  }

  /**
   * Check if a value is a RetryError
   *
   * @param {unknown} value
   * @returns {value is RetryError}
   */
  static is(value) {
    return isRequestError(value) && value.name === 'RetryError'
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
    const msg = `HttpError: ${options.response.status} - ${options.response.statusText}`

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

/**
 * Request timeout
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
export async function request(resource, options = {}) {
  const {
    signal,
    timeout = 5000,
    retry,
    fetch = globalThis.fetch.bind(globalThis),
    json,
    headers,
  } = options

  // validate resource type
  if (typeof resource !== 'string' && !(resource instanceof URL)) {
    throw new TypeError('`resource` must be a string or URL object')
  }

  const timeoutSignal = AbortSignal.timeout(timeout)
  const combinedSignals = anySignal([signal, timeoutSignal])

  const _headers = new Headers(headers)
  if (json !== undefined) {
    _headers.set(
      'content-type',
      _headers.get('content-type') ?? 'application/json'
    )
    options.body = JSON.stringify(json)
  }
  const request = new Request(resource, {
    ...options,
    headers: _headers,
    signal: combinedSignals,
  })

  try {
    const response = await (retry
      ? pRetry(
          async () => {
            const rsp = await fetch(request)
            if (!rsp.ok) {
              // Delay if needed using Retry-After header
              const delayValue = calculateRetryAfter(rsp)
              if (delayValue > 0) {
                await delay(delayValue, { signal: combinedSignals })
              }

              throw new HttpError({
                response: rsp,
                request,
                options,
              })
            }
            return rsp
          },
          { ...retry, signal: combinedSignals }
        )
      : fetch(request))

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

    if (timeoutSignal.aborted) {
      return { error: new TimeoutError(timeout, { cause: err }) }
    }

    if (signal?.aborted) {
      return { error: new AbortError(signal, { cause: err }) }
    }

    if ('attemptNumber' in err) {
      return {
        error: new RetryError(Number(err.attemptNumber), { cause: err }),
      }
    }

    return {
      error: new NetworkError(err.message, { cause: err.cause }),
    }
  }
}

/**
 *
 * @param {Response} response
 */
function calculateRetryAfter(response) {
  const retryAfter = response.headers.get('Retry-After')

  if (retryAfter === null) {
    return 0
  }

  let after = Number(retryAfter)
  if (Number.isNaN(after)) {
    after = Date.parse(retryAfter) - Date.now()
  } else {
    after *= 1000
  }

  return after
}

/**
 * Request GET
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.get = function get(resource, options = {}) {
  return request(resource, { ...options, method: 'GET' })
}

/**
 * Request POST
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.post = function post(resource, options = {}) {
  return request(resource, { ...options, method: 'POST' })
}

/**
 * Request PUT
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.put = function put(resource, options = {}) {
  return request(resource, { ...options, method: 'PUT' })
}

/**
 * Request DELETE
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.delete = function del(resource, options = {}) {
  return request(resource, { ...options, method: 'DELETE' })
}

/**
 * Request PATCH
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.patch = function patch(resource, options = {}) {
  return request(resource, { ...options, method: 'PATCH' })
}

/**
 * Request HEAD
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.head = function head(resource, options = {}) {
  return request(resource, { ...options, method: 'HEAD' })
}

/**
 * Request OPTIONS
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.options = function optionsFn(resource, options = {}) {
  return request(resource, { ...options, method: 'OPTIONS' })
}

/**
 * Request TRACE
 *
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").RequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<Response, Errors>>}
 */
request.trace = function trace(resource, options = {}) {
  return request(resource, { ...options, method: 'TRACE' })
}

/**
 * Request Json GET
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json = async function json(resource, options = {}) {
  const { error, result } = await request(resource, {
    ...options,
    // eslint-disable-next-line unicorn/no-null
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
    return { result: /** @type {T} */ (await result.json()) }
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
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.get = function get(resource, options = {}) {
  return request.json(resource, { ...options, method: 'GET' })
}

/**
 * Request Json POST
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.post = function post(resource, options = {}) {
  return request.json(resource, { ...options, method: 'POST' })
}

/**
 * Request Json PUT
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.put = function put(resource, options = {}) {
  return request.json(resource, { ...options, method: 'PUT' })
}

/**
 * Request Json DELETE
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.delete = function del(resource, options = {}) {
  return request.json(resource, { ...options, method: 'DELETE' })
}

/**
 * Request Json PATCH
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.patch = function patch(resource, options = {}) {
  return request.json(resource, { ...options, method: 'PATCH' })
}

/**
 * Request Json HEAD
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.head = function head(resource, options = {}) {
  return request.json(resource, { ...options, method: 'HEAD' })
}

/**
 * Request Json OPTIONS
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.options = function optionsFn(resource, options = {}) {
  return request.json(resource, { ...options, method: 'OPTIONS' })
}

/**
 * Request Json TRACE
 *
 * @template T
 * @param {import('./types.js').RequestInput} resource
 * @param {import("./types.js").JSONRequestOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, Errors | JsonError>>}
 */
request.json.trace = function trace(resource, options = {}) {
  return request.json(resource, { ...options, method: 'TRACE' })
}
