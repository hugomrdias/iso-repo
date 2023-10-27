import type { Options } from 'p-retry'
import type {
  CloseEvent,
  ErrorEvent,
  GenericEvent,
  MessageEvent,
  RetryEvent,
} from './events'

export interface WebSocketEventMap {
  close: CloseEvent
  error: ErrorEvent
  message: MessageEvent
  open: GenericEvent
  retry: RetryEvent
}

export type Data = string | ArrayBufferLike | Blob | ArrayBufferView

export type UrlProvider = string | URL | (() => string | URL)

export type ShouldRetryFn = (event: globalThis.CloseEvent | Event) => boolean

export interface WSOptions {
  /**
   * @see https://github.com/sxzz/unws
   */
  ws?: typeof WebSocket
  /**
   * Timeout in milliseconds for the connection to be established
   *
   * @default 5000
   */
  timeout?: number
  /**
   * Automatically open the connection
   *
   * @default true
   */
  automaticOpen?: boolean

  /**
   * Enable debug mode. This will log all events to the console.
   *
   * `DEBUG=iso-web:ws node test.js` will also enable debug mode
   *
   * @default false
   */
  debug?: boolean

  /**
   * Retry options
   *
   * @see https://github.com/tim-kos/node-retry?tab=readme-ov-file#retryoperationoptions
   */
  retry?: Options

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket#protocols
   */
  protocols?: string | string[]
  /**
   * Function to determine if the connection should be retried
   *
   * Retries by default on all close events except 1008 and 1011 and all error events
   *
   * @param event - The close event or an error event
   */
  shouldRetry?: ShouldRetryFn
}
