/* eslint-disable n/no-callback-literal */
import { WebSocketServer } from 'ws'

/**
 * @type {import("ws").WebSocketServer}
 */
let server

/** @type {import('playwright-test').RunnerOptions} */
const config = {
  beforeTests() {
    server = new WebSocketServer({
      port: 8080,
      verifyClient: (info, cb) => {
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
      const url = new URL(req.url, `http://${req.headers.host}`)
      const query = url.searchParams

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

      socket.on('message', (data) => {
        const msg = data.toString()
        if (url.pathname.startsWith('/echo')) {
          return msg === 'close' ? socket.close(1002) : socket.send(msg)
        }
      })
    })
  },

  afterTests() {
    for (const client of server.clients) {
      client.terminate()
    }
    server.removeAllListeners()
    server.close()
  },
}

export default config
