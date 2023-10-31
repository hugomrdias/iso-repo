# iso-ws [![NPM Version](https://img.shields.io/npm/v/iso-ws.svg)](https://www.npmjs.com/package/iso-ws) [![License](https://img.shields.io/npm/l/iso-ws.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-ws](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-ws.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-ws.yml)

`iso-ws` implements the [Websocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) interface and is compatible with the browser, node.js and any other engine that implements basic Web APIs.

## Features

- Standard API and isomorphic
- Reconnects automatically on close, connection timeout and connectivity events
- Supports connection timeout
- Extensible retry strategy with `shouldRetry` option and [`node-retry`](https://github.com/tim-kos/node-retry?tab=readme-ov-file#retryoperationoptions)
- Queue messages while offline, disconnected or reconnecting
- Supports custom url callback to reconnect to a different url
- Extensive tests
- Typed events

## Install

```bash
pnpm install iso-ws
```

## Usage

```js
import { WS } from 'iso-ws'

const ws = new WS('ws://localhost:8080')

ws.addEventListener('message', (e) => {
  console.log(e.data)
})

ws.send('hello')

ws.close()
```

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_ws.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
