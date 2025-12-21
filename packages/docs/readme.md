# @hugomrdias/docs [![NPM Version](https://img.shields.io/npm/v/%40hugomrdias/docs.svg)](https://www.npmjs.com/package/%40hugomrdias/docs) [![License](https://img.shields.io/npm/l/%40hugomrdias/docs.svg)](https://github.com/hugomrdias/iso-repo/blob/main/license)

> Starlight plugins for TypeScript documentation and AI chat integration

Two powerful plugins for [Starlight](https://starlight.astro.build/) documentation sites: generate API docs from TypeScript types using TypeDoc, and add page actions for copying content and opening pages in AI chat services.

## Install

```bash
pnpm install @hugomrdias/docs
```

## TypeDoc Plugin

Generates markdown documentation from TypeScript source code using TypeDoc. Automatically converts your TypeScript types, interfaces, classes, and functions into Starlight-compatible markdown files.

### Features

- Automatic markdown generation from TypeScript source code
- Custom Starlight theme with proper URL routing
- Watch mode support for development (auto-enabled in dev mode)
- Pagination support with prev/next navigation links
- Special JSDoc tag handling: `@deprecated`, `@alpha`, `@beta`, `@experimental` with Starlight asides
- Configurable output directory
- Supports all TypeDoc entry point strategies (packages, resolve, expand)

### Configuration

```typescript
import { docsPlugin } from '@hugomrdias/docs/starlight-typedoc'

docsPlugin({
  // Output directory relative to src/content/docs/
  outputDirectory: 'api', // default: 'api'
  
  // Enable prev/next navigation links in footer
  pagination: false, // default: false
  
  // Watch mode for development (auto-enabled in dev for non-package strategies)
  watch: false, // default: false (auto-enabled in dev)
  
  // TypeDoc configuration options
  typeDocOptions: {
    entryPointStrategy: 'packages',
    entryPoints: ['../packages/*'],
    tsconfig: '../tsconfig.json',
    excludeInternal: true,
    excludePrivate: true,
    excludeProtected: true,
    // ... all other TypeDoc options
  }
})
```

### Usage

```js
// astro.config.mjs
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { docsPlugin } from '@hugomrdias/docs/starlight-typedoc'

export default defineConfig({
  site: 'https://docs.dev',
  integrations: [
    starlight({
      title: 'My Documentation',
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

## LLMs Plugin

Adds page action buttons to your documentation pages and generates an `llms.txt` file for AI chat integration. Enables users to quickly copy page content or open pages in AI chat services with pre-filled prompts.

### Features

- **Copy Markdown** button to copy page content to clipboard
- **Open** dropdown menu with links to AI chat services (ChatGPT, Claude, T3 Chat, v0)
- Pre-filled prompts when opening pages in AI chats (customizable template)
- Automatic `/llms.txt` endpoint generation listing all documentation URLs
- Markdown file generation during build (accessible at `/{page}.md`)
- Customizable actions: enable/disable built-ins, add custom action links

### Configuration

```typescript
import { llmsPlugin } from '@hugomrdias/docs/starlight-llms'

llmsPlugin({
  // Prompt template for AI chat services (use {url} as placeholder)
  prompt: 'Read {url}. I want to ask questions about it.', // default shown
  
  // Base URL for llms.txt generation (uses Astro site config if not provided)
  baseUrl: 'https://docs.dev',
  
  // Site title (defaults to Starlight title)
  title: 'My Documentation',
  
  // Site description (defaults to Starlight description)
  description: 'Documentation for my project',
  
  // Configure which actions to display
  actions: {
    chatgpt: true,    // default: true
    claude: true,     // default: true
    t3chat: false,    // default: false
    v0: false,        // default: false
    markdown: true,   // default: true
    custom: {
      // Add custom action links
      myService: {
        label: 'Open in My Service',
        href: 'https://myservice.com/?query='
      }
    }
  }
})
```

### Usage

```js
// astro.config.mjs
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { llmsPlugin } from '@hugomrdias/docs/starlight-llms'

export default defineConfig({
  site: 'https://docs.dev', // Required for llms.txt generation
  integrations: [
    starlight({
      title: 'My Documentation',
      plugins: [
        llmsPlugin({
          prompt: 'Read {url} and explain its main points briefly.',
          actions: {
            chatgpt: true,
            claude: true,
            v0: true,
            markdown: true,
            custom: {
              customAi: {
                label: 'Open in Custom AI',
                href: 'https://custom-ai.com/?q='
              }
            }
          }
        }),
      ],
    }),
  ],
})
```

### llms.txt

The plugin automatically generates an `/llms.txt` endpoint that lists all your documentation URLs in a structured format. This file can be used by AI tools to discover and index your documentation.

## Combined Usage

Both plugins work together seamlessly:

```js
// astro.config.mjs
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'
import { docsPlugin } from '@hugomrdias/docs/starlight-typedoc'
import { llmsPlugin } from '@hugomrdias/docs/starlight-llms'

export default defineConfig({
  site: 'https://docs.dev',
  integrations: [
    starlight({
      title: 'My Documentation',
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
        llmsPlugin({
          prompt: 'Read {url} and help me understand it.',
        }),
      ],
    }),
  ],
})
```

## License

MIT © [Hugo Dias](http://hugodias.me)
