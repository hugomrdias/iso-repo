// This file is inserted into ./web by the build script

import WASM from '../dist/web/wasm_bg.wasm'
import { initSync } from '../dist/web/wasm.js'
initSync(WASM)
export * from '../dist/web/wasm.js'
