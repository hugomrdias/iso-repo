import type { OperationOptions } from 'retry'
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

export type ShouldRetryFn = (
  event: globalThis.CloseEvent | ErrorEvent
) => boolean

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
  retry?: OperationOptions

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket#protocols
   */
  protocols?: string | string[]
  /**
   * Function to determine if the connection should be retried
   *
   * Retries by default on all close events except 1008 (HTTP 400 equivalent)  and 1011 (HTTP 500 equivalent) and connection timeout events
   *
   * @param event - The close or connection timeout event
   */
  shouldRetry?: ShouldRetryFn
  /**
   * Reveal connection-time error information in Websocket error
   *
   * The *browser* spec for Websockets disallows revealing connection error info to prevent attacks but this is not applicable to *server* usage of WS in a trusted environment.
   *
   * @default false
   * */
  errorInfo?: boolean
}
