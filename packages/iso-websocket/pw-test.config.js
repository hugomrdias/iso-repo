import { WebSocketServer } from 'ws'

/**
 * @type {import("ws").WebSocketServer}
 */
let server

/** @type {Partial<import('playwright-test').RunnerOptions>} */
const config = {
  beforeTests() {
    server = new WebSocketServer({
      port: 8080,
      verifyClient: (info, cb) => {
        // @ts-ignore
        const url = new URL(info.req.url, `http://${info.req.headers.host}`)

        if (url.pathname.startsWith('/timeout')) {
          setTimeout(() => {
            cb(true)
          }, 1000)
        } else {
          cb(true)
        }
      },
    })

    server.on('connection', (socket, req) => {
      // @ts-ignore
      const url = new URL(req.url, `http://${req.headers.host}`)
      const query = url.searchParams

      // biome-ignore lint/suspicious/noConsole: needed
      socket.on('error', console.error)

      if (query.get('exitCode')) {
        setTimeout(
          () => {
            socket.close(
              Number(query.get('exitCode')),
              query.get('exitReason') || ''
            )
          },
          Number(query.get('delay') || 500)
        )
      }

      if (url.pathname.startsWith('/terminate')) {
        socket.terminate()
      }

      if (url.pathname.startsWith('/delayed-msg')) {
        socket.send('first msg')
        setTimeout(() => {
          socket.send('second msg')
        }, 1000)
      }

      socket.on('message', (data) => {
        const msg = data.toString()
        if (url.pathname.startsWith('/echo')) {
          return msg === 'close' ? socket.close(1002) : socket.send(msg)
        }
      })
    })
    return Promise.resolve()
  },

  afterTests() {
    for (const client of server.clients) {
      client.terminate()
    }
    server.removeAllListeners()
    server.close()
    return Promise.resolve()
  },
}

export default config
