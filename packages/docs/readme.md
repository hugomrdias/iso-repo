# @hugomrdias/docs [![NPM Version](https://img.shields.io/npm/v/%40hugomrdias/docs.svg)](https://www.npmjs.com/package/@hugomrdias/docs) [![License](https://img.shields.io/npm/l/%40hugomrdias/docs.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license)

> Typedoc tooling

## Install

```bash
pnpm install @hugomrdias/docs
```

## Usage

`astro.config.mjs`

```js

import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { docsPlugin } from '@hugomrdias/docs/starlight-typedoc'

const site = 'https://docs.dev'

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [
    starlight({
      title: 'docs',
      plugins: [
        docsPlugin({
          pagination: true,
          outputDirectory: 'reference',
          typeDocOptions: {
            entryPointStrategy: 'packages',
            entryPoints: ['../packages/*'],
            tsconfig: '../tsconfig.json',
          },
        }),
      ],
    }),
  ],
})
```

## License

MIT © [Hugo Dias](http://hugodias.me)
