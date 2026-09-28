import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPlayerMiddleware } from '../../scripts/player-data.ts'

export async function withPlayerServer(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'mini-games-players-'))
  const middleware = createPlayerMiddleware(directory)
  const server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404)
      res.end()
    }),
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const original = globalThis.fetch
  globalThis.fetch = (input, init) =>
    original(
      typeof input === 'string' && input.startsWith('/')
        ? `http://127.0.0.1:${address.port}${input}`
        : input,
      init,
    )
  try {
    await run(directory)
  } finally {
    globalThis.fetch = original
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    await rm(directory, { recursive: true, force: true })
  }
}
export const playerFixture = (id: string) => ({
  version: 1,
  player: { id, name: id, avatar: 'default', createdAt: '2026-09-28T00:00:00Z' },
  games: {},
})
