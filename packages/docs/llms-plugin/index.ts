import type { StarlightPlugin } from '@astrojs/starlight/types'
import { AstroError } from 'astro/errors'
import { normalizePath } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

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
 *
 * @see {@link https://starlight-page-actions.dlcastillop.com/docs/reference/configuration|Configuration Reference}
 *
 * @example
 * ```javascript
 * // astro.config.mjs
 * import starlight from '@astrojs/starlight';
 * import starlightPageActions from 'starlight-page-actions';
 *
 * export default defineConfig({
 *   integrations: [
 *     starlight({
 *       plugins: [
 *         starlightPageActions({
 *           prompt: "Read {url} and explain its main points briefly.",
 *           baseUrl: "https://mydocs.example.com",
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
export default function starlightPageActions(
  userConfig?: PageActionsConfig
): StarlightPlugin {
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
    name: 'starlight-page-actions',
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
          name: 'starlight-page-actions-integration',
          hooks: {
            'astro:config:setup': ({ updateConfig }) => {
              updateConfig({
                vite: {
                  plugins: [
                    {
                      name: 'starlight-page-actions-config',
                      resolveId(id) {
                        if (id === 'virtual:starlight-page-actions/config') {
                          return `\0${id}`
                        }
                      },
                      load(id) {
                        if (id === '\0virtual:starlight-page-actions/config') {
                          return `export default ${JSON.stringify(config)}`
                        }
                      },
                    },
                    viteStaticCopy({
                      targets: [
                        {
                          src: 'src/content/docs/**/*.{md,mdx}',
                          dest: '',
                          transform: (content: string) => {
                            const frontmatterRegex =
                              /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
                            const match = content.match(frontmatterRegex)

                            let title = ''
                            let markdownContent = content

                            if (
                              match &&
                              match[1] !== undefined &&
                              match[2] !== undefined
                            ) {
                              const frontmatter = match[1]
                              markdownContent = match[2]

                              const titleMatch = frontmatter.match(
                                /title:\s*["']?([^"'\n]+)["']?/
                              )
                              if (titleMatch && titleMatch[1] !== undefined) {
                                title = titleMatch[1].trim()
                              }
                            }

                            const contentWithoutImports = markdownContent
                            // .split('\n')
                            // .filter(
                            //   (line) => !line.trim().startsWith('import ')
                            // )
                            // .join('\n')

                            let newContent = ''

                            if (title) {
                              newContent = `# ${title}\n\n`
                            }

                            newContent += contentWithoutImports.trim()

                            return newContent
                          },
                          rename: (
                            fileName: string,
                            fileExtension: string,
                            fullPath: string
                          ) => {
                            const fullPathNormalized = normalizePath(fullPath)
                            const relativePath = (
                              fullPathNormalized.split(
                                'src/content/docs/'
                              )[1] as string
                            ).replace(new RegExp(`\\.${fileExtension}$`), '')
                            const pathSegments = relativePath.split('/')

                            if (fileName === 'index') {
                              if (pathSegments.length === 1) {
                                return 'index.md'
                              } else {
                                const directories = pathSegments
                                  .slice(0, -2)
                                  .join('/')
                                const folderName =
                                  pathSegments[pathSegments.length - 2]

                                return directories
                                  ? `${directories}/${folderName}.md`
                                  : `${folderName}.md`
                              }
                            }

                            const directories = pathSegments
                              .slice(0, -1)
                              .join('/')
                            const finalPath = directories
                              ? `${directories}/${fileName}.md`
                              : `${fileName}.md`

                            return finalPath.replace('@', '')
                          },
                        },
                      ],
                    }),
                  ],
                },
              })
            },
          },
        })

        addIntegration({
          name: 'llms',
          hooks: {
            'astro:config:setup'({ injectRoute }) {
              const entrypoint = new URL('llms.txt.ts', import.meta.url)
              injectRoute({
                entrypoint,
                pattern: '/llms.txt',
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
