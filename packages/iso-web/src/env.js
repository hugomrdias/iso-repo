// 'use strict'
// const isElectron = require('is-electron')

// https://github.com/electron/electron/issues/2288
/**
 *
 */
function isElectron() {
  // Renderer process
  if (
    typeof window !== 'undefined' &&
    typeof window.process === 'object' &&
    // @ts-ignore
    window.process.type === 'renderer'
  ) {
    return true
  }

  // Main process
  if (
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    Boolean(process.versions.electron)
  ) {
    return true
  }

  // Detect the user agent when the `nodeIntegration` option is set to false
  if (
    typeof navigator === 'object' &&
    typeof navigator.userAgent === 'string' &&
    navigator.userAgent.includes('Electron')
  ) {
    return true
  }

  return false
}

export const IS_ENV_WITH_DOM =
  typeof window === 'object' &&
  typeof document === 'object' &&
  document.nodeType === 9

export const IS_ELECTRON = isElectron()
/**
 * Detects browser main thread  **NOT** web worker or service worker
 */
export const IS_BROWSER = IS_ENV_WITH_DOM && !IS_ELECTRON
export const IS_ELECTRON_MAIN = IS_ELECTRON && !IS_ENV_WITH_DOM
export const IS_ELECTRON_RENDERER = IS_ELECTRON && IS_ENV_WITH_DOM
export const IS_NODE =
  //   typeof require === 'function' &&
  typeof process !== 'undefined' &&
  process.release !== undefined &&
  process.release.name === 'node' &&
  !IS_ELECTRON
export const IS_WEBWORKER =
  // @ts-ignore - we either ignore worker scope or dom scope
  typeof importScripts === 'function' &&
  typeof globalThis !== 'undefined' &&
  // @ts-ignore - we either ignore worker scope or dom scope
  typeof WorkerGlobalScope !== 'undefined' &&
  // @ts-ignore - we either ignore worker scope or dom scope
  // eslint-disable-next-line no-undef
  globalThis instanceof WorkerGlobalScope
export const IS_TEST =
  typeof process !== 'undefined' &&
  process.env !== undefined &&
  process.env.NODE_ENV === 'test'
export const IS_REACT_NATIVE =
  typeof navigator !== 'undefined' && navigator.product === 'ReactNative'
