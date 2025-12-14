/// <reference types="node_modules/astro/types.d.ts" />

declare module 'virtual:starlight-page-actions/config' {
  const config: import('./index').PageActionsConfig
  export default config
}
