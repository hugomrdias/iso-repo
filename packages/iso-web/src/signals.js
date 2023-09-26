/**
 * Isomorphic signals
 *
 * @module
 */

/**
 * Combines an array of AbortSignals into a single signal that is aborted when any signal is
 *
 * @param {Iterable<AbortSignal | undefined>} signals - The signals to combine
 * @returns {AbortSignal} - The combined signal
 */
export function anySignal(signals) {
  const controller = new AbortController()

  for (const signal of signals) {
    if (signal && 'aborted' in signal && 'reason' in signal) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        return signal
      }

      signal.addEventListener('abort', () => controller.abort(signal.reason), {
        signal: controller.signal,
        once: true,
      })
    }
  }

  return controller.signal
}
