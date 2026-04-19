/**
 * Runtime stub for the type-only `./types.ts` module so that
 * `export * from './types.js'` in `index.js` resolves under plain Node
 * (e.g. when consumers run `.ts` files via `--experimental-strip-types`).
 *
 * All real declarations live in `./types.ts`; TypeScript's bundler
 * resolution prefers the `.ts` file at type-check time.
 */
export {}
