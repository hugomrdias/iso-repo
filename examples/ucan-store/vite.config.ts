import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { cloudflare } from '@cloudflare/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
})
