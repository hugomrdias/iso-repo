import { TypedEventTarget } from 'typescript-event-target'
import debug from 'debug'
import * as retry from 'retry'
import {
  CloseEvent,
  ErrorEvent,
  GenericEvent,
  MessageEvent,
  RetryEvent,
} from './events.js'

const log = debug('iso-web:ws')

/**
 * @typedef {import('./types.js').WebSocketEventMap} WebSocketEventMap
 * @typedef {import('./types.js').WSOptions} WSOptions
 */

/** @type {import('./types.js').ShouldRetryFn} */
function defaultShouldRetry(event) {
  return 'code' in event ? event.code !== 1008 && event.code !== 1011 : true
}

/**
 * @class WS
 * @extends {TypedEventTarget<WebSocketEventMap>}
 */
export class WS extends TypedEventTarget {
  /** @type {BinaryType} */
  #binaryType = 'blob'

  /** @type {import('./types.js').UrlProvider} */
  #url

  /** @type {WebSocket | undefined} */
  #ws

  /** @type {import('./types.js').Data[]} */
  #queue = []

  /** @type {import('retry').RetryOperation | undefined} */
  #retry

  /** @type {boolean} */
  #reconnectWhenOnline = false

  /**
   *
   * @param {import('./types.js').UrlProvider} url
   * @param {import('./types.js').WSOptions} [options]
   */
  constructor(url, options = {}) {
    super()

    if (!options.ws && typeof WebSocket === 'undefined') {
      throw new TypeError('No WebSocket implementation found.')
    }

    this.#url = url
    /** @type {Required<WSOptions>} */
    this.options = {
      timeout: 5000,
      automaticOpen: true,
      protocols: [],
      ws: options.ws || WebSocket,
      debug: false,
      retry: {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10_000,
        randomize: false,
      },
      shouldRetry: defaultShouldRetry,
      ...options,
    }

    if (this.options.debug) {
      debug.enable('iso-web:ws')
    }

    if (this.options.automaticOpen) {
      this.open()
    }
  }

  static get CONNECTING() {
    return 0
  }

  static get OPEN() {
    return 1
  }

  static get CLOSING() {
    return 2
  }

  static get CLOSED() {
    return 3
  }

  get CONNECTING() {
    return WS.CONNECTING
  }

  get OPEN() {
    return WS.OPEN
  }

  get CLOSING() {
    return WS.CLOSING
  }

  get CLOSED() {
    return WS.CLOSED
  }

  get binaryType() {
    return this.#ws ? this.#ws.binaryType : this.#binaryType
  }

  /**
   * Returns a string that indicates how binary data from the WebSocket object is exposed to scripts:
   *
   * Can be set, to change how binary data is returned. The default is "blob".
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/binaryType)
   *
   * @param {BinaryType} type
   */
  set binaryType(type) {
    this.#binaryType = type
    if (this.#ws) {
      this.#ws.binaryType = type
    }
  }

  /**
   * Returns the state of the WebSocket object's connection. It can have the values described below.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/readyState)
   */
  get readyState() {
    return this.#ws ? this.#ws.readyState : 0
  }

  /**
   * Returns the number of bytes of application data (UTF-8 text and binary data) that have been queued using send() but not yet been transmitted to the network.
   *
   * If the WebSocket connection is closed, this attribute's value will only increase with each call to the send() method. (The number does not reset to zero once the connection closes.)
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/bufferedAmount)
   */
  get bufferedAmount() {
    /** @type {number} */
    const init = 0
    // eslint-disable-next-line unicorn/no-array-reduce
    const queueBytes = this.#queue.reduce((acc, data) => {
      if (typeof data === 'string') {
        return acc + new Blob([data]).size
      }

      if (data instanceof Blob) {
        return acc + data.size
      }

      return acc + data.byteLength
    }, init)
    return queueBytes + (this.#ws ? this.#ws.bufferedAmount : 0)
  }

  /**
   * Returns the extensions selected by the server, if any.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/extensions)
   */
  get extensions() {
    return this.#ws ? this.#ws.extensions : ''
  }

  /**
   * Returns the subprotocol selected by the server, if any. It can be used in conjunction with the array form of the constructor's second argument to perform subprotocol negotiation.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/protocol)
   */
  get protocol() {
    return this.#ws ? this.#ws.protocol : ''
  }

  /**
   * Returns the URL that was used to establish the WebSocket connection.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/url)
   */
  get url() {
    return this.#ws ? this.#ws.url : ''
  }

  #getUrl() {
    return typeof this.#url === 'function' ? this.#url() : this.#url
  }

  #addListeners() {
    if (this.#ws) {
      this.#ws.addEventListener('open', this.#handleOpen)
      this.#ws.addEventListener('close', this.#handleClose)
      this.#ws.addEventListener('error', this.#handleError)
      this.#ws.addEventListener('message', this.#handleMessage)
    }

    if ('addEventListener' in globalThis) {
      globalThis.addEventListener('online', this.#handleOnline)
      globalThis.addEventListener('offline', this.#handleOffline)
    }
  }

  #removeListeners() {
    if (this.#ws) {
      this.#ws.removeEventListener('open', this.#handleOpen)
      this.#ws.removeEventListener('close', this.#handleClose)
      this.#ws.removeEventListener('error', this.#handleError)
      this.#ws.removeEventListener('message', this.#handleMessage)
    }

    if ('removeEventListener' in globalThis) {
      globalThis.removeEventListener('online', this.#handleOnline)
      globalThis.removeEventListener('offline', this.#handleOffline)
    }
  }

  #handleOffline = () => {
    log('offline event')
    this.#retry?.stop()
    this.#retry = undefined
    this.#ws?.close(1000)
    this.#reconnectWhenOnline = true
  }

  #handleOnline = () => {
    log('online event')
    if (this.#reconnectWhenOnline) {
      this.#connect()
    }
  }

  /**
   * @param {Event} event
   */
  #handleOpen = (event) => {
    log('open event')

    if (!this.#ws) {
      throw new TypeError('Open event before socket should never happend.')
    }

    this.#reconnectWhenOnline = false

    if (this.onopen) {
      this.onopen(event)
    }
    this.dispatchTypedEvent('open', GenericEvent.clone(event))

    if (this.#queue.length > 0) {
      log('flushing queue', this.#queue)
    }
    for (const data of this.#queue) {
      this.#ws.send(data)
    }
    this.#queue = []
  }

  /**
   *
   * @param {globalThis.CloseEvent} event
   */
  #handleClose = (event) => {
    log('close event %s %s %s', event.code, event.reason, event.wasClean)

    this.#maybeReconnect(event)

    if (this.onclose) {
      this.onclose(event)
    }

    this.dispatchTypedEvent('close', CloseEvent.clone(event))
  }

  #handleMessage = (/** @type {MessageEvent} */ event) => {
    log('message event', event.data.toString())

    this.#retry?.reset()

    if (this.onmessage) {
      this.onmessage(event)
    }

    this.dispatchTypedEvent('message', MessageEvent.clone(event))
  }

  /**
   * @see https://stackoverflow.com/questions/31002592/javascript-doesnt-catch-error-in-websocket-instantiation/31003057#31003057
   * @param {globalThis.Event} event
   */
  #handleError = (event) => {
    log('error event', event)

    const err = new ErrorEvent({
      message: 'Websocket error',
      error: new Error('Websocket error'),
    })

    if (this.onerror) {
      this.onerror(err)
    }
    this.dispatchTypedEvent('error', err)
  }

  #connect() {
    if (
      'navigator' in globalThis &&
      'onLine' in navigator &&
      !navigator.onLine
    ) {
      this.#addListeners()
      this.#reconnectWhenOnline = true
      return
    }

    this.#retry = retry.operation(this.options.retry)
    this.#retry.attempt(
      (currentAttempt) => {
        const url = this.#getUrl()
        log('connect to %s attempt %s', url, currentAttempt)
        this.#removeListeners()

        const Ws = this.options.ws

        this.#ws = new Ws(url, this.options.protocols)
        this.#ws.binaryType = this.#binaryType
        this.#addListeners()
      },
      {
        timeout: this.options.timeout,
        // @ts-ignore
        cb: () => {
          this.#removeListeners()
          this.#maybeReconnect(
            new ErrorEvent({ message: 'Connection timeout' })
          )
        },
      }
    )
  }

  /**
   *
   * @param {globalThis.CloseEvent | ErrorEvent} event
   * @param {import('./types.js').ShouldRetryFn} [shouldRetry]
   */
  #maybeReconnect(event, shouldRetry = this.options.shouldRetry) {
    const msg =
      'code' in event
        ? `Closed with ${event.code} ${event.reason || ''}`
        : event.message

    if (!shouldRetry(event) || ('code' in event && event.code === 1000)) {
      log('will not retry %s', msg)
      return
    }

    if (!this.#retry) {
      return new TypeError('Retry before connecting should never happen.')
    }

    const willRetry = this.#retry.retry(new Error(msg))
    const retryCount = this.#retry.attempts()

    if (willRetry) {
      log('retrying %s retry %s', this.#getUrl(), retryCount)
      this.dispatchTypedEvent('retry', new RetryEvent({ attempt: retryCount }))
    } else {
      this.dispatchTypedEvent(
        'error',
        new ErrorEvent({
          message: `Connection failed after ${retryCount} attempts.`,
          error: this.#retry.mainError(),
        })
      )
      this.#retry = undefined
    }
  }

  /**
   * Open the WebSocket connection manual when `automaticOpen` is false.
   *
   * @see {@link WSOptions}
   */
  open() {
    if (
      this.#ws &&
      (this.#ws.readyState === WS.OPEN || this.#ws.readyState === WS.CONNECTING)
    ) {
      log('websocket already open')
      return
    }

    this.#connect()
  }

  /** @type {((this: WS, ev: CloseEvent) => any) | undefined} */
  onclose = undefined
  /** @type {((this: WS, ev: Event) => any) | undefined} */
  onerror = undefined
  /** @type {((this: WS, ev: MessageEvent) => any) | undefined} */
  onmessage = undefined
  /** @type {((this: WS, ev: Event) => any) | undefined} */
  onopen = undefined

  /**
   * Transmits data using the WebSocket connection. data can be a string, a Blob, an ArrayBuffer, or an ArrayBufferView.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/send)
   *
   * @param {import('./types.js').Data} data
   */
  send(data) {
    if (this.#ws && this.#ws.readyState === WS.OPEN) {
      log('send', data)
      this.#ws.send(data)
    } else {
      if (this.#queue.length < 100) {
        log('enqueue', data)
        this.#queue.push(data)
      }
    }
  }

  /**
   * Closes the WebSocket connection, optionally using code as the the WebSocket connection close code and reason as the the WebSocket connection close reason.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/close)
   *
   * @param {number} [code]
   * @param {string} [reason]
   */
  close(code = 1000, reason) {
    log('close %s %s', code, reason)
    this.#removeListeners()
    this.#retry?.stop()
    this.#retry = undefined
    this.#reconnectWhenOnline = false

    if (!this.#ws) {
      log('no websocket to close')
      return
    }

    if (this.#ws.readyState === WS.CLOSED) {
      log('websocket already closed')
      return
    }

    this.#ws.close(code, reason)
  }
}
