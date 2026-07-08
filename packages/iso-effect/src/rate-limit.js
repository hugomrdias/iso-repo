/**
 * @typedef {import('./types').RateLimit} RateLimit
 */

/**
 * Converts a public rate-limit duration into milliseconds.
 *
 * The runner uses this during limiter construction so invalid duration values
 * fail when an effect is first registered in a runner, before any handler work
 * starts.
 *
 * @param {RateLimit} rateLimit
 */
export function rateLimitToMs(rateLimit) {
  if (!rateLimit) {
    return 0
  }

  if (rateLimit.per === 'second') {
    return 1000
  }

  if (rateLimit.per === 'minute') {
    return 60_000
  }

  if (typeof rateLimit.per === 'number' && Number.isFinite(rateLimit.per)) {
    return rateLimit.per
  }

  throw new TypeError(
    'Expected rateLimit.per to be "second", "minute", or a finite number of milliseconds.'
  )
}

/**
 * Fixed-window rate limiter used by `EffectRunner`.
 *
 * Each instance tracks one effect in one runner. Calls acquire capacity before
 * handler execution. If no capacity remains in the current window, callers wait
 * in FIFO order until a later window opens.
 */
export class WindowRateLimiter {
  /** @type {number} */
  #calls
  /** @type {number} */
  #duration
  /** @type {number} */
  #available
  /** @type {number} */
  #windowStart
  /** @type {Array<() => void>} */
  #queue = []
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  #timer

  /**
   * Creates a limiter for a positive number of calls per duration window.
   *
   * @param {Exclude<RateLimit, false>} rateLimit
   */
  constructor(rateLimit) {
    if (!Number.isInteger(rateLimit.calls) || rateLimit.calls <= 0) {
      throw new TypeError('Expected rateLimit.calls to be a positive integer.')
    }

    this.#calls = rateLimit.calls
    this.#duration = rateLimitToMs(rateLimit)

    if (this.#duration <= 0) {
      throw new TypeError('Expected rateLimit.per to be greater than 0ms.')
    }

    this.#available = this.#calls
    this.#windowStart = Date.now()
  }

  /**
   * Number of calls currently waiting for a future window.
   */
  get queued() {
    return this.#queue.length
  }

  /**
   * Waits until the caller has capacity to execute.
   *
   * If the current window still has available calls this resolves immediately.
   * Otherwise it resolves after one or more window resets, preserving FIFO order
   * for queued callers.
   */
  async acquire() {
    this.#resetExpiredWindow()

    if (this.#available > 0) {
      this.#available--
      return
    }

    await new Promise((resolve) => {
      this.#queue.push(() => resolve(undefined))
      this.#ensureTimer()
    })
  }

  /**
   * Restores full capacity when the current window has elapsed.
   */
  #resetExpiredWindow() {
    const now = Date.now()

    if (now >= this.#windowStart + this.#duration) {
      this.#available = this.#calls
      this.#windowStart = now
    }
  }

  /**
   * Schedules the next queue drain at the current window boundary.
   */
  #ensureTimer() {
    if (this.#timer) {
      return
    }

    const now = Date.now()
    const delay = Math.max(0, this.#windowStart + this.#duration - now)

    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.#available = this.#calls
      this.#windowStart = Date.now()
      this.#drainQueue()

      if (this.#queue.length > 0) {
        this.#ensureTimer()
      }
    }, delay)
  }

  /**
   * Releases queued callers until the window capacity is exhausted.
   */
  #drainQueue() {
    while (this.#available > 0 && this.#queue.length > 0) {
      this.#available--
      const resolve = this.#queue.shift()
      resolve?.()
    }
  }
}
