import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { playerDataPlugin } from './scripts/player-data'

export default defineConfig({
  plugins: [react(), playerDataPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist/client',
  },
  server: {
    port: 5183,
  },
})
