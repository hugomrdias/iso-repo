# iso-web [![NPM Version](https://img.shields.io/npm/v/iso-web.svg)](https://www.npmjs.com/package/iso-web) [![License](https://img.shields.io/npm/l/iso-web.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![CI](https://github.com/hugomrdias/iso-repo/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/hugomrdias/iso-repo/actions/workflows/ci.yml)

> Isomorphic web apis utilities for fetch, event target, signals, crypto and doh.

## Install

```bash
pnpm install iso-web
```

## MSW

`iso-web/msw` needs [msw](https://mswjs.io) 3, an optional peer dependency:

```bash
pnpm install -D msw@3
```

In browsers the worker script must match the installed msw. Generate it again and deploy it every time msw is upgraded, with a worker from msw 2 `stop()` never resolves and the next `start()` hangs:

```bash
pnpm exec msw init <PUBLIC_DIR>
```

## License

MIT © [Hugo Dias](http://hugodias.me)
