import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devClientLogPlugin } from './vite-plugin-dev-log'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function appendProxyLog(line: string) {
  const dir = path.join(__dirname, 'log')
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'vite-proxy.log'), line + '\n')
  } catch {
    /* ignore */
  }
}

export default defineConfig({
  plugins: [react(), devClientLogPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (_proxyReq, req) => {
            appendProxyLog(`[${new Date().toISOString()}] ${req.method ?? ''} ${req.url ?? ''}`)
          })
          proxy.on('error', err => {
            appendProxyLog(`[${new Date().toISOString()}] ERROR ${err.message}`)
          })
        },
      },
    },
  },
})
