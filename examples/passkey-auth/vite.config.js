import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import wasm from 'vite-plugin-wasm'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), wasm()],
})
