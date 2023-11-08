/* eslint-disable unicorn/prefer-add-event-listener */
import { assert, suite } from 'playwright-test/taps'
import * as Client from 'playwright-test/client'
import pDefer from 'p-defer'
import delay from 'delay'
import { WebSocket } from 'unws'
import { WS } from '../src/index.js'

const test = suite('ws')

const URL = 'ws://localhost:8080'

test('should queue and send', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '/echo', { ws: WebSocket })
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

test('should handle close', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '?exitCode=1002&exitReason=testing', {
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

test('should unclean close', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '/terminate', {
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

test('should retry', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '?exitCode=1002&exitReason=testing', {
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

test('should not retry on code 1000', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '?exitCode=1000', {
    retry: {
      retries: 1,
    },
    ws: WebSocket,
  })

  ws.addEventListener('error', (e) => {
    deferred.reject(new Error('Should not error'))
  })
  ws.addEventListener('retry', () => {
    deferred.reject(new Error('Should not retry'))
  })

  ws.addEventListener('close', (e) => {
    deferred.resolve()
  })

  await deferred.promise
  ws.close()
})

test('should force stop retries', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '?exitCode=1002', {
    ws: WebSocket,
  })

  let retries = 0
  ws.addEventListener('close', (e) => {
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

test('should stop > message > stop and reset retry count', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '/echo', {
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

test('should error and fix itself by changing urls', async () => {
  const deferred = pDefer()

  let errorHappened = false
  /**
   *
   */
  function getUrl() {
    return errorHappened ? URL + '/echo' : 'ws://localhost:5900'
  }
  const ws = new WS(getUrl, {
    ws: WebSocket,
  })

  ws.addEventListener('error', (e) => {
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

test('should not auto open, queue msg and send when opened', async () => {
  const deferred = pDefer()

  const ws = new WS(URL + '/echo', { automaticOpen: false, ws: WebSocket })

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

test(
  'should reconnect when online',
  async () => {
    const deferred = pDefer()
    await Client.context.setOffline(true)

    const ws = new WS(URL + '/echo', { ws: WebSocket })

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
  },
  {
    skip: Client.options.mode === 'node',
  }
)

test(
  'should connect, go offline and connect again',
  async () => {
    const deferred = pDefer()

    const ws = new WS(URL + '/echo', { ws: WebSocket })
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
  },
  {
    skip: Client.options.mode === 'node',
  }
)

test(
  'should not reconnect when explicitly closed',
  async () => {
    const ws = new WS(URL + '/echo', { ws: WebSocket })
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
  },
  {
    skip: Client.options.mode === 'node',
  }
)

test('should not reconnect if already open', async () => {
  const ws = new WS(URL + '/echo', { ws: WebSocket, retry: {} })
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

test('should error on "onerror" hook', async () => {
  const deferred = pDefer()
  const ws = new WS('ws://localhost:8003', {
    ws: WebSocket,
  })
  ws.onerror = (e) => {
    deferred.resolve()
  }
  ws.open()

  await deferred.promise
  ws.close()
})

test('should open on "onopen" hook', async () => {
  const deferred = pDefer()
  const ws = new WS(URL, {
    ws: WebSocket,
  })
  ws.addEventListener('open', (e) => {
    deferred.resolve()
  })
  ws.open()

  await deferred.promise
  ws.close()
})

test('should message on "onmessage" hook ', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '/echo', { ws: WebSocket })
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

test('should close on "onclose" hook', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '?exitCode=1002&exitReason=testing', {
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

test('should retry timeout ', async () => {
  const deferred = pDefer()
  const ws = new WS(URL + '/timeout', {
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

test('should not retry timeout after connect opened', async () => {
  const deferred = pDefer()
  let count = 0
  const ws = new WS(URL + '/delayed-msg', {
    ws: WebSocket,
    timeout: 100,
    retry: {
      retries: 1,
    },
  })

  ws.addEventListener('error', (e) => {
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
