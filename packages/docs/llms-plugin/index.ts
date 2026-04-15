import type { StarlightPlugin } from '@astrojs/starlight/types'
import { AstroError } from 'astro/errors'

interface Actions {
  chatgpt?: boolean
  claude?: boolean
  t3chat?: boolean
  v0?: boolean
  markdown?: boolean
  custom?: Record<string, CustomAction>
}

interface CustomAction {
  label: string
  href: string
}

export interface PageActionsConfig {
  prompt?: string
  baseUrl?: string
  actions?: Actions
  title?: string
  description?: string
  maxDepth?: number
}

/**
 * Starlight plugin that adds page action buttons to your documentation.
 *
 * This plugin adds:
 * - A "Copy Markdown" button to copy the raw markdown content
 * - An "Open" dropdown menu with options to open the page in AI chat services (ChatGPT, Claude, etc.)
 * - Automatic generation of the `llms.txt` file with all documentation URLs during build
 *
 * @param {PageActionsConfig} [userConfig] - Configuration options for the plugin.
 * @param {string} [userConfig.prompt] - The prompt template for AI chat services. Use `{url}` as placeholder for the markdown URL.
 * @param {string} [userConfig.baseUrl] - The base URL of your site, required for generating the `llms.txt` file.
 * @param {Actions} [userConfig.actions] - Configure which built-in actions to display and define custom actions.
 * @param {number} [userConfig.maxDepth] - The maximum depth of the documentation tree to include in the `llms.txt` file. Defaults to 4.
 *
 * @example
 * ```javascript
 * // astro.config.mjs
 * import starlight from '@astrojs/starlight';
 * import { llmsPlugin } from '@hugomrdias/docs/llms-plugin';
 *
 * export default defineConfig({
 *   integrations: [
 *     starlight({
 *       plugins: [
 *         llmsPlugin({
 *           prompt: "Read {url} and explain its main points briefly.",
 *           baseUrl: "https://mydocs.example.com",
 *           maxDepth: 3,
 *           actions: {
 *            chatgpt: false,
 *            v0: true,
 *            custom: {
 *              sciraAi: {
 *                label: "Open in Scira AI",
 *                href: "https://scira.ai/?q="
 *              }
 *            }
 *           }
 *         })
 *       ]
 *     })
 *   ]
 * });
 * ```
 *
 */
export function llmsPlugin(userConfig?: PageActionsConfig): StarlightPlugin {
  const defaultConfig: PageActionsConfig = {
    prompt: 'Read {url}. I want to ask questions about it.',
    actions: {
      chatgpt: true,
      claude: true,
      t3chat: false,
      v0: false,
      markdown: true,
    },
  }

  return {
    name: 'llms-plugin',
    hooks: {
      'config:setup'({
        astroConfig,
        addIntegration,
        updateConfig,
        config: starlightConfig,
        logger,
      }) {
        const config: PageActionsConfig = {
          ...defaultConfig,
          ...userConfig,
          actions: {
            ...defaultConfig.actions,
            ...userConfig?.actions,
          },
          title: userConfig?.title || (starlightConfig.title as string),
          description:
            userConfig?.description || starlightConfig.description || '',
        }

        const hasActions =
          config.actions?.chatgpt ||
          config.actions?.claude ||
          config.actions?.t3chat ||
          config.actions?.v0 ||
          config.actions?.markdown ||
          (config.actions?.custom &&
            Object.keys(config.actions.custom).length > 0)

        if (!hasActions) {
          logger.warn('No actions enabled. The dropdown will be hidden.')
        }

        if (!astroConfig.site) {
          throw new AstroError(
            '`site` not set in Astro configuration',
            'The `llms` plugin requires setting `site` in your Astro configuration file.'
          )
        }

        addIntegration({
          name: 'llms',
          hooks: {
            'astro:config:setup'({ updateConfig, injectRoute }) {
              updateConfig({
                vite: {
                  plugins: [
                    {
                      name: 'llms-plugin-config',
                      resolveId(id: string) {
                        if (id === 'virtual:llms-plugin/config') {
                          return `\0${id}`
                        }
                        return undefined
                      },
                      load(id: string) {
                        if (id === '\0virtual:llms-plugin/config') {
                          return `export default ${JSON.stringify(config)}`
                        }
                        return undefined
                      },
                    },
                  ],
                },
              })

              injectRoute({
                entrypoint: '@hugomrdias/docs/llms.txt',
                pattern: '/llms.txt',
              })

              injectRoute({
                entrypoint: '@hugomrdias/docs/llms-full.txt',
                pattern: '/llms-full.txt',
              })

              injectRoute({
                entrypoint: '@hugomrdias/docs/markdown',
                pattern: '/[...slug].md',
              })
            },
          },
        })

        updateConfig({
          components: {
            PageTitle: '@hugomrdias/docs/PageTitle',
            ...starlightConfig.components,
          },
        })
      },
    },
  }
}
