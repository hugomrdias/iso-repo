import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import debug from 'debug'
import delay from 'delay'
import pDefer from 'p-defer'
import * as Client from 'playwright-test/client'
/* eslint-disable unicorn/prefer-add-event-listener */
import { WS } from '../src/index.js'

// set in pw-test.config.js
const URL = /** @type {string} */ (process.env.WS_URL)

/**
 * @param {() => void | Promise<void>} fn
 */
async function withoutGlobalWebSocket(fn) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket')
  // @ts-expect-error
  delete globalThis.WebSocket
  try {
    await fn()
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'WebSocket', descriptor)
    }
  }
}

describe('ws', () => {
  it('should throw TypeError when no WebSocket implementation exists', async () => {
    const NativeWebSocket = WebSocket
    await withoutGlobalWebSocket(() => {
      assert.throws(
        () => new WS(URL, { automaticOpen: false }),
        TypeError,
        'No WebSocket implementation found.'
      )
      const ws = new WS(URL, { automaticOpen: false, ws: NativeWebSocket })
      assert.equal(ws.options.ws, NativeWebSocket)
    })
  })

  it('should enable the logger namespace with debug option', () => {
    const previous = debug.disable()
    try {
      new WS(URL, { automaticOpen: false, ws: WebSocket, debug: true })
      assert.ok(debug.enabled('iso-ws'))
    } finally {
      debug.enable(previous)
    }
  })

  it('should queue and send', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}/echo`, { ws: WebSocket })
    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('wrong message'))
      }
    })

    ws.send('test')

    await deferred.promise
    ws.close()
  })

  it('should handle close', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}?exitCode=1002&exitReason=testing`, {
      ws: WebSocket,
    })

    ws.addEventListener('close', (e) => {
      if (e.code === 1002 && e.reason === 'testing' && e.wasClean) {
        deferred.resolve()
      } else {
        deferred.reject(new Error(`Failed to close ${e.code} and ${e.reason}`))
      }
    })

    await deferred.promise
    ws.close()
  })

  it('should unclean close', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}/terminate`, {
      ws: WebSocket,
    })

    ws.addEventListener('close', (e) => {
      if (e.code === 1006 && !e.wasClean) {
        deferred.resolve()
      } else {
        deferred.reject(new Error(`Failed to close ${e.code} and unclean`))
      }
    })

    await deferred.promise
    ws.close()
  })

  it('should retry', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}?exitCode=1002&exitReason=testing`, {
      retry: {
        retries: 1,
      },
      ws: WebSocket,
    })

    ws.addEventListener('error', (e) => {
      if (e.message === 'Connection failed after 2 attempts.') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('Failed to retry twice'))
      }
    })

    await deferred.promise
    ws.close()
  })

  it('should not retry on code 1000', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}?exitCode=1000`, {
      retry: {
        retries: 1,
      },
      ws: WebSocket,
    })

    ws.addEventListener('error', () => {
      deferred.reject(new Error('Should not error'))
    })
    ws.addEventListener('retry', () => {
      deferred.reject(new Error('Should not retry'))
    })

    ws.addEventListener('close', () => {
      deferred.resolve()
    })

    await deferred.promise
    ws.close()
  })

  it('should force stop retries', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}?exitCode=1002`, {
      ws: WebSocket,
    })

    let retries = 0
    ws.addEventListener('close', () => {
      if (retries === 1) {
        deferred.resolve()
      } else {
        deferred.reject(new Error('Failed to retry twice'))
      }
    })

    ws.addEventListener('retry', (e) => {
      retries++
      if (e.attempt === 2) {
        ws.close()
      }
    })
    await deferred.promise
  })

  it('should stop > message > stop and reset retry count', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}/echo`, {
      ws: WebSocket,
      retry: {
        retries: 1,
      },
    })

    let msgSent = false

    ws.addEventListener('retry', (e) => {
      if (e.attempt === 1 && !msgSent) {
        ws.send('test')
        msgSent = true
      } else {
        ws.send('close')
      }
    })

    ws.addEventListener('error', (e) => {
      if (e.message === 'Connection failed after 2 attempts.') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('Failed to retry trice'))
      }
    })

    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        ws.send('close')
      } else {
        deferred.reject(new Error('wrong message'))
      }
    })

    ws.send('close')

    await deferred.promise
    ws.close()
  })

  it('should error and fix itself by changing urls', async () => {
    const deferred = pDefer()

    let errorHappened = false
    /**
     *
     */
    function getUrl() {
      return errorHappened ? `${URL}/echo` : 'ws://localhost:5900'
    }
    const ws = new WS(getUrl, {
      ws: WebSocket,
    })

    ws.addEventListener('error', () => {
      errorHappened = true
    })

    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('wrong message'))
      }
    })
    ws.send('test')

    await deferred.promise
    assert.ok(errorHappened)
    ws.close()
  })

  it('should not auto open, queue msg and send when opened', async () => {
    const deferred = pDefer()

    const ws = new WS(`${URL}/echo`, { automaticOpen: false, ws: WebSocket })

    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('wrong message'))
      }
    })
    ws.send('test')
    ws.open()

    await deferred.promise
    ws.close()
  })

  it('should reconnect when online', {
    skip: Client.options.mode === 'node',
  }, async () => {
    const deferred = pDefer()
    await Client.context.setOffline(true)

    const ws = new WS(`${URL}/echo`, { ws: WebSocket })

    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('wrong message'))
      }
    })
    ws.send('test')

    await Client.context.setOffline(false)

    await deferred.promise
    ws.close()
  })

  it('should connect, go offline and connect again', {
    skip: Client.options.mode === 'node',
  }, async () => {
    const deferred = pDefer()

    const ws = new WS(`${URL}/echo`, { ws: WebSocket })
    let openCount = 0

    ws.addEventListener('open', () => {
      openCount++
    })

    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        Client.context.setOffline(true)
      }

      if (e.data === 'done') {
        deferred.resolve()
      }
    })

    ws.send('test')
    setTimeout(() => {
      Client.context.setOffline(false)
      ws.send('done')
    }, 500)

    await deferred.promise
    assert.equal(openCount, 2)
    ws.close()
  })

  it('should not reconnect when explicitly closed', {
    skip: Client.options.mode === 'node',
  }, async () => {
    const ws = new WS(`${URL}/echo`, { ws: WebSocket })
    let openCount = 0
    let closeCount = 0

    ws.addEventListener('open', () => {
      openCount++
    })
    ws.addEventListener('close', () => {
      closeCount++
    })

    ws.addEventListener('message', (e) => {
      if (e.data === 'test') {
        Client.context.setOffline(true)
      }
    })

    ws.send('test')
    setTimeout(() => {
      ws.close()
      Client.context.setOffline(false)
    }, 200)

    await delay(500)
    assert.equal(openCount, 1)
    assert.equal(closeCount, 1)
    ws.close()
  })

  it('should not reconnect if already open', async () => {
    const ws = new WS(`${URL}/echo`, { ws: WebSocket, retry: {} })
    let openCount = 0

    ws.addEventListener('open', () => {
      openCount++
      if (openCount === 1) {
        ws.open()
      }
    })

    ws.send('test')

    await delay(500)
    assert.equal(openCount, 1)
    ws.close()
  })

  it('should error on "onerror" hook', async () => {
    const deferred = pDefer()
    const ws = new WS('ws://localhost:8003', {
      ws: WebSocket,
    })
    ws.onerror = () => {
      deferred.resolve()
    }
    ws.open()

    await deferred.promise
    ws.close()
  })

  it('should open on "onopen" hook', async () => {
    const deferred = pDefer()
    const ws = new WS(URL, {
      ws: WebSocket,
    })
    ws.addEventListener('open', () => {
      deferred.resolve()
    })
    ws.open()

    await deferred.promise
    ws.close()
  })

  it('should message on "onmessage" hook ', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}/echo`, { ws: WebSocket })
    ws.onmessage = (e) => {
      if (e.data === 'test') {
        deferred.resolve()
      } else {
        deferred.reject(new Error('wrong message'))
      }
    }

    ws.send('test')

    await deferred.promise
    ws.close()
  })

  it('should close on "onclose" hook', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}?exitCode=1002&exitReason=testing`, {
      ws: WebSocket,
    })

    ws.addEventListener('close', (e) => {
      if (e.code === 1002 && e.reason === 'testing' && e.wasClean) {
        deferred.resolve()
      } else {
        deferred.reject(new Error(`Failed to close ${e.code} and ${e.reason}`))
      }
    })

    await deferred.promise
    ws.close()
  })

  it('should retry timeout ', async () => {
    const deferred = pDefer()
    const ws = new WS(`${URL}/timeout`, {
      ws: WebSocket,
      timeout: 100,
      retry: {
        retries: 1,
      },
    })

    ws.addEventListener('error', (e) => {
      if (e.error.message === 'Connection timeout') {
        deferred.resolve()
      }
    })

    await deferred.promise
  })

  it('should not retry timeout after connect opened', async () => {
    const deferred = pDefer()
    let count = 0
    const ws = new WS(`${URL}/delayed-msg`, {
      ws: WebSocket,
      timeout: 100,
      retry: {
        retries: 1,
      },
    })

    ws.addEventListener('error', () => {
      count++
    })

    ws.addEventListener('message', (e) => {
      if (e.data === 'second msg') {
        deferred.resolve()
      }
    })

    await deferred.promise
    assert.equal(count, 0)
    ws.close()
  })

  it('should not retry timeout after opened and closed without retry', async () => {
    const closed = pDefer()
    let retries = 0
    let errors = 0
    const ws = new WS(`${URL}?exitCode=4004&delay=50`, {
      ws: WebSocket,
      timeout: 300,
      shouldRetry: (e) => !('code' in e && e.code === 4004),
    })

    ws.addEventListener('retry', () => {
      retries++
    })
    ws.addEventListener('error', () => {
      errors++
    })
    ws.addEventListener('close', () => {
      closed.resolve()
    })

    await closed.promise
    await delay(500)
    assert.equal(retries, 0)
    assert.equal(errors, 0)
    ws.close()
  })

  it('should not retry timeout after server closes with 1000', async () => {
    const closed = pDefer()
    let retries = 0
    const ws = new WS(`${URL}?exitCode=1000&delay=50`, {
      ws: WebSocket,
      timeout: 300,
    })

    ws.addEventListener('retry', () => {
      retries++
    })
    ws.addEventListener('close', () => {
      closed.resolve()
    })

    await closed.promise
    await delay(500)
    assert.equal(retries, 0)
    ws.close()
  })
})
