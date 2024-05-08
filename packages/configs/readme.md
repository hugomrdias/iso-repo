# @hugomrdias/configs [![NPM Version](https://img.shields.io/npm/v/%40hugomrdias/configs.svg)](https://www.npmjs.com/package/@hugomrdias/configs) [![License](https://img.shields.io/npm/l/%40hugomrdias/configs.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license)

> JS tooling config

## Install

```bash
pnpm install @hugomrdias/configs
```

## Usage

`package.json`

```json
{
  "main": "src/index.js",
  "types": "dist/src/index.d.ts",
  "files": ["dist/src", "src"],
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
  "extends": "@hugomrdias/configs/tsconfig",
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
  "extends": "@hugomrdias/configs/tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src", "test.js", "cli.js", "package.json"]
}
```

In monorepos you can install `@hugomrdias/configs` only in the root and extend the root `tsconfig.json` in the packages.

## License

MIT © [Hugo Dias](http://hugodias.me)
