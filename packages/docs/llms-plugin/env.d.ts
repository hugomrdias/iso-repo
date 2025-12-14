/// <reference types="node_modules/astro/types.d.ts" />

declare module 'virtual:llms-plugin/config' {
  const config: import('./index').PageActionsConfig
  export default config
}
