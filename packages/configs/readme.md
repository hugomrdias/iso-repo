# @hugomrdias/configs [![NPM Version](https://img.shields.io/npm/v/%40hugomrdias/configs.svg)](https://www.npmjs.com/package/@hugomrdias/configs) [![License](https://img.shields.io/npm/l/%40hugomrdias/configs.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license)

> JS tooling config

## Install

```bash
pnpm install @hugomrdias/configs

# in monorepo root install
pnpm install @hugomrdias/configs -w -D  
pnpm install @biomejs/biome -w -D
```

## Usage

`biome.json`

```json

{
  "extends": ["@hugomrdias/configs/biome"]
}

```

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
    "pre-commit": "pnpm exec biome check --no-errors-on-unmatched --files-ignore-unknown=true --staged"
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
  "include": ["src", "test"]
}
```

For typescript code bases:

```json
{
  "extends": "@hugomrdias/configs/tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "module": "NodeNext"
  },
  "include": ["src", "test"]
}
```

In monorepos you can install `@hugomrdias/configs` only in the root and extend the root `tsconfig.json` in the packages.

## License

MIT © [Hugo Dias](http://hugodias.me)
