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

### Defaults and required fields

Missing top-level keys are filled from the `defaults` option and then from schema defaults, on every read and write. `defaults` is required when the schema has required fields without a schema default, since a fresh config would otherwise fail validation.

```js
const schema = z.object({
  token: z.string(),
  retries: z.number().default(3),
})

const config = new Conf({ projectName: 'my-app', schema, defaults: { token: '' } })

config.reset('token') // => ''
config.clear() // => { token: '', retries: 3 }
```

The schema output is what gets written to disk and validated again on the next read, so it must also be valid schema input. Transforms that change a value's type (e.g. `z.string().transform((s) => s.length)`) are rejected on write.

### Reading never writes

Creating a `Conf` and reading from it (`get`, `has`, `size`, `store`, iteration) never touches the disk beyond reading the config file. The file is read and validated on every access, so a missing, corrupt or schema-invalid file throws from the first read, not from the constructor. A missing file reads as defaults and its folder is not created, so reads work in read-only folders.

Defaults, schema defaults and coerced values are applied in memory on every read, and reach the disk on the next write (`set`, `delete`, `reset`, `appendToArray`, `clear` or `store =`).

The one exception is `watch: true`, which creates an empty config file (and its folder) when there is none, because `fs.watch` needs a target.

## Docs

Check <https://hugomrdias.github.io/iso-repo/modules/iso_conf.html>

## License

MIT © [Hugo Dias](http://hugodias.me)
