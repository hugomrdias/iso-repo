# iso-config [![NPM Version](https://img.shields.io/npm/v/iso-config.svg)](https://www.npmjs.com/package/iso-config) [![License](https://img.shields.io/npm/l/iso-config.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license) [![iso-config](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-config.yml/badge.svg)](https://github.com/hugomrdias/iso-repo/actions/workflows/iso-config.yml)

> JS tooling config

## Install

```bash
pnpm install iso-config
```

## Usage

`package.json`

```json
{
  "main": "src/index.js",
  "types": "dist/src/index.d.ts",
  "files": ["dist/src", "src", "index.js", "cli.js"],
  "scripts": {
    "lint": "biome check --no-errors-on-unmatched --files-ignore-unknown=true ."
  },
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "*": "biome check --no-errors-on-unmatched --files-ignore-unknown=true"
  }
}
```

`tsconfig.json`

```json
{
  "extends": "iso-config/tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "emitDeclarationOnly": true
  },
  "include": ["src", "test.js", "cli.js", "package.json"]
}
```

For typescript code bases:

```json
{
  "extends": "iso-config/tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src", "test.js", "cli.js", "package.json"]
}
```

In monorepos you can install `iso-config` only in the root and extend the root `tsconfig.json` in the packages.

## License

MIT © [Hugo Dias](http://hugodias.me)
