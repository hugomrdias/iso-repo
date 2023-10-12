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

  /** @type {import('type-fest').JsonValue | undefined} */
  data

  /** @type {Response | undefined} */
  response

  /**
   *
   * @param {string} text - This should be `response.text()`
   * @param {ErrorOptions & {response: Response}} options
   */
  constructor(text, options) {
    let data
    let msg = `${options.response.statusText}${text ? ' - ' + text : ''}`
    try {
      data = JSON.parse(text)
      msg = `${options.response.statusText} - More details in "error.data"`
    } catch {}

    super(msg, options)

    this.data = data
    this.code = options.response?.status ?? 0
    this.response = options.response
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
 * @template T
 * @param {RequestInfo} resource
 * @param {import("./types.js").FetchOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, HttpError | AbortError | TimeoutError | NetworkError | RetryError>>}
 */
async function _request(resource, options = {}) {
  const { signal, timeout, fetch = globalThis.fetch.bind(globalThis) } = options

  // validate resource type
  if (
    typeof resource !== 'string' &&
    !(resource instanceof URL || resource instanceof Request)
  ) {
    throw new TypeError('`resource` must be a string, URL, or Request')
  }

  const url = new URL(resource.toString())
  const timeoutSignal = AbortSignal.timeout(timeout ?? 5000)
  const combinedSignals = anySignal([signal, timeoutSignal])

  try {
    const response = await fetch(url.toString(), {
      ...options,
      signal: combinedSignals,
    })

    if (response.ok) {
      const data = await response.json()
      return { result: /** @type {T} */ (data) }
    } else {
      const text = await response.text()
      return {
        error: new HttpError(text, {
          response,
        }),
      }
    }
  } catch (error) {
    const err = /** @type {Error} */ (error)

    if (timeoutSignal.aborted) {
      return { error: new TimeoutError(timeout ?? 5000, { cause: err }) }
    }

    if (signal?.aborted) {
      return { error: new AbortError(signal, { cause: err }) }
    }

    return {
      error: new NetworkError(err.message, { cause: err.cause }),
    }
  }
}

/**
 * Request with retry and timeout
 *
 * @template T
 * @param {RequestInfo} resource
 * @param {import("./types.js").FetchOptions} options
 * @returns {Promise<import("./types.js").MaybeResult<T, HttpError | AbortError | TimeoutError | NetworkError | RetryError>>}
 */
export async function request(resource, options = {}) {
  const { signal, retry } = options

  try {
    const response = await (retry
      ? pRetry(
          async () => {
            const { error, result } = await _request(resource, options)
            if (error) {
              throw error
            }
            return result
          },
          { ...retry, signal }
        )
      : _request(resource, options))

    return response
  } catch (error) {
    const err = /** @type {Error} */ (error)

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
