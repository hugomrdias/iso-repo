import path from 'node:path'
import url from 'node:url'
import type { StarlightPlugin } from '@astrojs/starlight/types'
import type { AstroIntegrationLogger } from 'astro'
import { slug } from 'github-slugger'
import {
  Application,
  type Comment,
  type CommentDisplayPart,
  type CommentTag,
  Logger,
  LogLevel,
  type Options,
  PageEvent,
  ParameterType,
  type ProjectReflection,
  Reflection,
  TSConfigReader,
  type TypeDocOptions,
} from 'typedoc'
import {
  type MarkdownPageEvent,
  MarkdownTheme,
  MarkdownThemeContext,
  type PluginOptions,
} from 'typedoc-plugin-markdown'
import { stringify } from 'yaml'

export type TypeDocWithMarkdownPlugin = TypeDocOptions & PluginOptions

export interface DocsPluginOptions {
  /**
   * The output directory containing the generated documentation markdown files relative to the `src/content/docs/`
   * directory.
   * @default 'api'
   */
  outputDirectory?: string
  /**
   * Whether the footer should include previous and next page links for the generated documentation.
   * @default false
   */
  pagination?: boolean
  /**
   * Whether to watch the entry point(s) for changes and regenerate the documentation when needed.
   * @default false
   */
  watch?: boolean

  /**
   * The TypeDoc options to pass to the plugin.
   * @default _defaultTypeDocOptions
   */
  typeDocOptions?: TypeDocWithMarkdownPlugin
}

const _defaultTypeDocOptions: TypeDocWithMarkdownPlugin = {
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  githubPages: false,
  readme: 'none',
  theme: 'starlight-typedoc',
  hideBreadcrumbs: true,
  hidePageHeader: true,
  hidePageTitle: true,
  entryFileName: 'index',
}

export function getUrlPath(outputDirectory: string, base = '') {
  return path.posix.join(
    base,
    `/${outputDirectory}${outputDirectory.endsWith('/') ? '' : '/'}`
  )
}

export function docsPlugin(options: DocsPluginOptions = {}): StarlightPlugin {
  return {
    name: 'docs-plugin',
    hooks: {
      'config:setup': async ({ astroConfig, command, logger }) => {
        if (command === 'preview') return

        if (
          command === 'dev' &&
          options.typeDocOptions?.entryPointStrategy !== 'packages' &&
          options.typeDocOptions?.entryPointStrategy !== 'merge'
        ) {
          options.watch = options.watch ?? true
        }

        if (command === 'build') {
          options.watch = false
        }

        const directory = options.outputDirectory ?? 'api'
        try {
          const output = {
            base: astroConfig.base,
            directory,
            path: path.join(
              url.fileURLToPath(astroConfig.srcDir),
              'content/docs',
              directory
            ),
            urlPath: getUrlPath(directory, astroConfig.base),
          }

          const app = await Application.bootstrapWithPlugins({
            ..._defaultTypeDocOptions,
            ...options.typeDocOptions,
            plugin: [
              ...(options.typeDocOptions?.plugin ?? []),
              'typedoc-plugin-markdown',
            ],
            outputs: [{ name: 'markdown', path: output.path }],
            readme: 'none',
            packageOptions: {
              readme: 'none',
            },
          })

          app.logger = new StarlightTypeDocLogger(logger)
          app.options.addDeclaration({
            defaultValue: output.urlPath,
            help: 'The starlight-typedoc output directory containing the generated documentation markdown files relative to the `src/content/docs/` directory.',
            name: 'docs-plugin-url-path',
            type: ParameterType.String,
          })

          app.options.addReader(new TSConfigReader())
          app.renderer.defineTheme('starlight-typedoc', StarlightTypeDocTheme)
          app.renderer.on(PageEvent.END, (_event) => {
            const event = _event as MarkdownPageEvent
            const frontmatter: Record<string, unknown> = {
              title: event.model.name,
              next: options.pagination,
              prev: options.pagination,
              editUrl: false,
            }

            if (event.url.includes('index.md')) {
              frontmatter.title = 'Index'
              frontmatter.sidebar = { order: 0 }
            }

            if (!event.frontmatter) {
              event.contents = `---
${stringify(frontmatter)}
---

${event.contents}`
            }
          })

          let reflections: ProjectReflection | undefined

          if (options.watch) {
            reflections = await new Promise<ProjectReflection>((resolve) => {
              void app.convertAndWatch(async (reflections) => {
                await app.generateOutputs(reflections)
                resolve(reflections)
              })
            })
          } else {
            reflections = await app.convert()

            if (
              (!reflections?.groups || reflections.groups.length === 0) &&
              !reflections?.children?.some(
                (child) => (child.groups ?? []).length > 0
              )
            ) {
              throw new Error('No reflections found')
            }

            await app.generateOutputs(reflections)
          }
        } catch (error) {
          // biome-ignore lint/suspicious/noConsole: log error
          console.error(error)
        }
      },
    },
  }
}

const customBlockTagTypes = ['@deprecated'] as const
const customModifiersTagTypes = ['@alpha', '@beta', '@experimental'] as const

export class StarlightTypeDocTheme extends MarkdownTheme {
  override getRenderContext(
    event: MarkdownPageEvent<Reflection>
  ): StarlightTypeDocThemeRenderContext {
    return new StarlightTypeDocThemeRenderContext(
      this,
      event,
      this.application.options
    )
  }
}

class StarlightTypeDocThemeRenderContext extends MarkdownThemeContext {
  constructor(
    theme: MarkdownTheme,
    event: MarkdownPageEvent<Reflection>,
    options: Options
  ) {
    super(theme, event, options)

    const superPartials = this.partials

    this.partials = {
      ...superPartials,
      comment: (comment, options) => {
        const filteredComment = { ...comment } as Comment
        filteredComment.blockTags = []
        filteredComment.modifierTags = new Set<`@${string}`>()

        const customTags: CustomTag[] = []

        for (const blockTag of comment.blockTags) {
          if (this.#isCustomBlockCommentTagType(blockTag.tag)) {
            customTags.push({ blockTag, type: blockTag.tag })
          } else {
            blockTag.content = blockTag.content.map((part) =>
              this.#parseCommentDisplayPart(part)
            )
            filteredComment.blockTags.push(blockTag)
          }
        }

        for (const modifierTag of comment.modifierTags) {
          if (this.#isCustomModifierCommentTagType(modifierTag)) {
            customTags.push({ type: modifierTag })
          } else {
            filteredComment.modifierTags.add(modifierTag)
          }
        }

        filteredComment.summary = comment.summary.map((part) =>
          this.#parseCommentDisplayPart(part)
        )

        let markdown = superPartials.comment(filteredComment, options)

        if (options?.showSummary === false) {
          return markdown
        }

        for (const customCommentTag of customTags) {
          switch (customCommentTag.type) {
            case '@alpha': {
              markdown = this.#addReleaseStageAside(markdown, 'Alpha')
              break
            }
            case '@beta': {
              markdown = this.#addReleaseStageAside(markdown, 'Beta')
              break
            }
            case '@deprecated': {
              markdown = this.#addDeprecatedAside(
                markdown,
                customCommentTag.blockTag
              )
              break
            }
            case '@experimental': {
              markdown = this.#addReleaseStageAside(markdown, 'Experimental')
              break
            }
          }
        }

        return markdown
      },
    }
  }

  override urlTo(reflection: Reflection): string {
    const outputDirectory = this.options.getValue('docs-plugin-url-path')
    const baseUrl = typeof outputDirectory === 'string' ? outputDirectory : ''

    return getRelativeURL(
      this.router.getFullUrl(reflection),
      baseUrl,
      this.page.url
    )
  }

  #parseCommentDisplayPart = (part: CommentDisplayPart): CommentDisplayPart => {
    if (
      part.kind === 'inline-tag' &&
      (part.tag === '@link' ||
        part.tag === '@linkcode' ||
        part.tag === '@linkplain') &&
      part.target instanceof Reflection
    ) {
      return {
        ...part,
        target: this.urlTo(part.target),
      }
    }

    return part
  }

  #isCustomBlockCommentTagType = (tag: string): tag is CustomBlockTagType => {
    return customBlockTagTypes.includes(tag as CustomBlockTagType)
  }

  #isCustomModifierCommentTagType = (
    tag: string
  ): tag is CustomModifierTagType => {
    return customModifiersTagTypes.includes(tag as CustomModifierTagType)
  }

  #addAside(markdown: string, ...args: Parameters<typeof getAsideMarkdown>) {
    return `${markdown}\n\n${getAsideMarkdown(...args)}`
  }

  #addDeprecatedAside(markdown: string, blockTag: CommentTag) {
    const content =
      blockTag.content.length > 0
        ? this.helpers.getCommentParts(blockTag.content)
        : 'This API is no longer supported and may be removed in a future release.'

    return this.#addAside(markdown, 'caution', 'Deprecated', content)
  }

  #addReleaseStageAside(markdown: string, title: string) {
    return this.#addAside(
      markdown,
      'caution',
      title,
      'This API should not be used in production and may be trimmed from a public release.'
    )
  }
}

type CustomBlockTagType = (typeof customBlockTagTypes)[number]
type CustomModifierTagType = (typeof customModifiersTagTypes)[number]

type CustomTag =
  | { type: CustomModifierTagType }
  | {
      blockTag: CommentTag
      type: CustomBlockTagType
    }
type AsideType = 'caution' | 'danger' | 'note' | 'tip'

export function getAsideMarkdown(
  type: AsideType,
  title: string,
  content: string
) {
  return `:::${type}[${title}]
  ${content}
  :::`
}
const externalLinkRegex = /^(http|ftp)s?:\/\//

export function getRelativeURL(
  url: string,
  baseUrl: string,
  pageUrl?: string
): string {
  if (externalLinkRegex.test(url)) {
    return url
  }

  const currentDirname = path.dirname(pageUrl ?? '')
  const urlDirname = path.dirname(url)
  const relativeUrl =
    currentDirname === urlDirname
      ? url
      : path.posix.join(
          currentDirname,
          path.posix.relative(currentDirname, url)
        )

  const filePath = path.parse(relativeUrl)
  const [, anchor] = filePath.base.split('#')
  const segments = filePath.dir
    .split(/[/\\]/)
    .map((segment) => slug(segment))
    .filter((segment) => segment !== '')

  let constructedUrl = typeof baseUrl === 'string' ? baseUrl : ''
  constructedUrl += segments.length > 0 ? `${segments.join('/')}/` : ''
  const fileNameSlug = slug(filePath.name)
  constructedUrl += fileNameSlug || filePath.name
  constructedUrl += '/'
  constructedUrl += anchor && anchor.length > 0 ? `#${anchor}` : ''
  return constructedUrl.replace('/index/', '/')
}

export class StarlightTypeDocLogger extends Logger {
  #logger: AstroIntegrationLogger

  constructor(logger: AstroIntegrationLogger) {
    super()

    this.#logger = logger
  }

  override log(message: string, level: LogLevel): void {
    super.log(message, level)

    if (level < this.level) {
      return
    }

    switch (level) {
      case LogLevel.Error: {
        this.#logger.error(message)
        break
      }
      case LogLevel.Warn: {
        this.#logger.warn(message)
        break
      }
      case LogLevel.Verbose: {
        this.#logger.debug(message)
        break
      }
      default: {
        this.#logger.info(message)
        break
      }
    }
  }
}
