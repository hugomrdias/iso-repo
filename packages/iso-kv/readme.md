# iso-kv [![NPM Version](https://img.shields.io/npm/v/iso-kv.svg)](https://www.npmjs.com/package/iso-kv) [![License](https://img.shields.io/npm/l/iso-kv.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-kv](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-kv.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-kv.yml)

> iso-key is a simple key-value storage with support for multiple backend adapters (localstorage, indexeddb, memory, sql, json file, etc)

## Features

- Fully typed
- TTL (time to live) for keys
- Multiple backend adapters (localstorage, indexeddb, memory, sql, json file, etc)
- On change hooks
- Easy to implement new adapters
- SQL adapter uses [kysely](https://kysely.dev/)

## Install

```bash
pnpm install iso-kv
```

## Todo

- [ ] codecs for json with buffer, dates etc
- [ ] more docs

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_kv.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
