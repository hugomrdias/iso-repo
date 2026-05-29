# iso-conf [![NPM Version](https://img.shields.io/npm/v/iso-conf.svg)](https://www.npmjs.com/package/iso-conf) [![License](https://img.shields.io/npm/l/iso-conf.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-conf](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-conf.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-conf.yml)

> Simple config handling for your app or module with [Standard Schema](https://standardschema.dev) validation and extended JSON serialization

## Features

- Fully typed via [Standard Schema](https://standardschema.dev) — works with Zod, Valibot, ArkType, and more
- Extended JSON types (URL, Map, Set, bigint, RegExp, Uint8Array)
- Atomic writes to disk
- Dot-notation access for nested properties
- Change hooks (`onDidChange`, `onDidAnyChange`)
- Defaults from schema

## Install

```bash
pnpm install iso-conf
```

## Usage

```js
import { z } from 'zod/v4'
import { Conf } from 'iso-conf'

const schema = z.object({
  foo: z.number().min(1).max(100).default(50),
  bar: z.url().optional(),
})

const config = new Conf({ projectName: 'my-app', schema })

config.set('foo', 42)
console.log(config.get('foo'))
//=> 42
```

Any [Standard Schema](https://standardschema.dev) compliant library can be used for the `schema` option. Zod is shown above as an example only.

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_conf.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
