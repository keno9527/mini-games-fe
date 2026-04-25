import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** 开发服务器：浏览器经 POST /__client-log 写入 pc-react/log/api-client.log */
export function devClientLogPlugin(): Plugin {
  return {
    name: 'dev-client-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/__client-log') || req.method !== 'POST') {
          next()
          return
        }
        const dir = path.join(process.cwd(), 'log')
        const file = path.join(dir, 'api-client.log')
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          try {
            fs.mkdirSync(dir, { recursive: true })
            const body = Buffer.concat(chunks).toString('utf8').slice(0, 8000)
            const line = `[${new Date().toISOString()}] ${body.replace(/\n/g, ' ')}\n`
            fs.appendFileSync(file, line)
          } catch {
            /* ignore disk errors */
          }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}
