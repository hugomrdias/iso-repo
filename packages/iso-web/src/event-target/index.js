/**
 * @import {ValueIsEvent, ITypedEventTarget, TypedEventListenerOrEventListenerObject} from './types.js'
 */

/**
 * @template {ValueIsEvent<M>} M
 * @implements {ITypedEventTarget<M>}
 */
export class TypedEventTarget extends EventTarget {
  /**
   * Dispatches a synthetic event to target and returns true if either
   * event's cancelable attribute value is false or its preventDefault() method
   * was not invoked, and false otherwise.
   *
   * @template {keyof M} T
   * @param {T} _type
   * @param {M[T]} event
   * @returns {boolean}
   */
  dispatchTypedEvent(_type, event) {
    return super.dispatchEvent(event)
  }

  /**
   * Dispatches a synthetic event to target and returns true if either
   * event's cancelable attribute value is false or its preventDefault() method
   * was not invoked, and false otherwise.
   *
   * @type {ITypedEventTarget<M>['emit']}
   */
  emit(type, detail) {
    return super.dispatchEvent(new CustomEvent(type.toString(), { detail }))
  }

  /**
   * @inheritdoc {ITypedEventTarget<M>['addEventListener']}
   * @template {keyof M & string} T
   * @param {T} type
   * @param {TypedEventListenerOrEventListenerObject<M, T> | null} callback
   * @param {boolean | AddEventListenerOptions} [options]
   */
  addEventListener(type, callback, options) {
    // @ts-ignore
    super.addEventListener(type, callback, options)
  }

  /**
   * Alias for {@link TypedEventTarget.addEventListener}
   *
   * @template {keyof M & string} T
   * @param {T} type
   * @param {TypedEventListenerOrEventListenerObject<M, T> | null} callback
   * @param {boolean | AddEventListenerOptions} [options]
   */
  on(type, callback, options) {
    // @ts-expect-error - Event and CustomEvent dont match
    super.addEventListener(type, callback, options)
  }

  /**
   * @inheritdoc {ITypedEventTarget<M>['removeEventListener']}
   * @template {keyof M & string} T
   * @param {T} type
   * @param {TypedEventListenerOrEventListenerObject<M, T> | null} callback
   * @param {boolean | EventListenerOptions} [options]
   */
  removeEventListener(type, callback, options) {
    // @ts-ignore
    super.removeEventListener(type, callback, options)
  }

  /**
   * Alias for {@link TypedEventTarget.removeEventListener}
   *
   * @template {keyof M & string} T
   * @param {T} type
   * @param {TypedEventListenerOrEventListenerObject<M, T> | null} callback
   * @param {boolean | EventListenerOptions} [options]
   */
  off(type, callback, options) {
    // @ts-ignore
    super.removeEventListener(type, callback, options)
  }

  /**
   * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
   *
   * @deprecated use dispatchTypedEvent instead
   * @param {Event} event
   */
  dispatchEvent(event) {
    return super.dispatchEvent(event)
  }
}
