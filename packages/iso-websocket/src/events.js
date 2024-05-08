/**
 * @class ErrorEvent
 */
export class ErrorEvent extends Event {
  /**
   *
   * @param {ErrorEventInit} [eventInitDict]
   */
  constructor(eventInitDict) {
    super('error', eventInitDict)
    this.message = eventInitDict?.message
    this.error = eventInitDict?.error
  }

  /**
   * @param {Event} event
   */
  static clone(event) {
    return new ErrorEvent({
      // @ts-ignore
      message: 'message' in event ? event.message : '',
      error: 'error' in event ? event.error : undefined,
    })
  }
}

export class MessageEvent extends Event {
  /**
   *
   * @param {string} type
   * @param {MessageEventInit} [eventInitDict]
   */
  constructor(type, eventInitDict) {
    super(type, eventInitDict)
    this.data = eventInitDict?.data
  }

  /**
   * @param {{ type: string; data: any; }} event
   */
  static clone(event) {
    return new MessageEvent(event.type, {
      data: event.data,
    })
  }
}

export class CloseEvent extends Event {
  /**
   *
   * @param {string} type
   * @param {CloseEventInit} [eventInitDict]
   */
  constructor(type, eventInitDict) {
    super(type, eventInitDict)
    this.code = eventInitDict?.code
    this.reason = eventInitDict?.reason
    this.wasClean = eventInitDict?.wasClean
  }

  /**
   *
   * @param {globalThis.CloseEvent} event
   */
  static clone(event) {
    return new CloseEvent(event.type, {
      code: event?.code,
      reason: event.reason,
      wasClean: event.wasClean,
    })
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class GenericEvent extends Event {
  /**
   * @param {{ type: string; }} event
   */
  static clone(event) {
    return new GenericEvent(event.type, {})
  }
}

export class RetryEvent extends Event {
  /**
   *
   * @param {EventInit & {attempt?: number}} [eventInitDict]
   */
  constructor(eventInitDict) {
    super('retry', eventInitDict)
    this.attempt = eventInitDict?.attempt ?? 0
  }

  /**
   *
   * @param {globalThis.Event} event
   */
  static clone(event) {
    return new RetryEvent(event)
  }
}
