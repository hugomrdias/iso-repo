/// <reference types="node_modules/astro/types.d.ts" />

declare module 'astro:config/client' {
  export const site: string
}

declare module 'astro:content' {
  export function getCollection(
    collection: 'docs',
    filter?: (doc: { data: { draft?: boolean } }) => boolean
  ): Promise<import('./strip').DocEntry[]>
}

declare module 'virtual:llms-plugin/config' {
  const config: import('./index').PageActionsConfig
  export default config
}
