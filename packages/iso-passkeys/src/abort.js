/**
 * A way to cancel an existing WebAuthn request, for example to cancel a
 * WebAuthn autofill authentication request for a manual authentication attempt.
 */
class AbortService {
  /** @type {AbortController | undefined} */
  #controller

  /**
   * Prepare an abort signal that will help support multiple auth attempts without needing to
   * reload the page
   */
  createSignal() {
    // Abort any existing calls to navigator.credentials.create() or navigator.credentials.get()
    if (this.#controller) {
      this.#controller.abort(
        'Cancelling existing WebAuthn API call for new one'
      )
    }

    const newController = new AbortController()

    this.#controller = newController
    return newController.signal
  }
}

export const abortService = new AbortService()
