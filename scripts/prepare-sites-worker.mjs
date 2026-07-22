import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const serverDir = resolve('dist', 'server')
const workerPath = resolve(serverDir, 'index.js')
const workerSourcePath = resolve('scripts', 'sites-worker-runtime.js')

await mkdir(serverDir, { recursive: true })
await copyFile(workerSourcePath, workerPath)
