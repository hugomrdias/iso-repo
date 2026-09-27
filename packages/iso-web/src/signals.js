/**
 * Isomorphic signals
 *
 * @module
 */

/**
 * @param {unknown} signal
 * @returns {signal is AbortSignal}
 */
function isSignal(signal) {
  return (
    signal != null &&
    typeof signal === 'object' &&
    'aborted' in signal &&
    'reason' in signal
  )
}

/**
 * Combines an array of AbortSignals into a single signal that is aborted when any signal is
 *
 * Uses `AbortSignal.any` when available, which does not retain listeners on the input signals.
 *
 * @param {Iterable<AbortSignal | undefined>} signals - The signals to combine
 * @returns {AbortSignal} - The combined signal
 */
export function anySignal(signals) {
  const filtered = [...signals].filter(isSignal)

  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(filtered)
  }

  // Fallback for runtimes without `AbortSignal.any`. Listeners are only removed
  // when the combined signal aborts.
  const controller = new AbortController()

  for (const signal of filtered) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return signal
    }

    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      signal: controller.signal,
      once: true,
    })
  }

  return controller.signal
}
