import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  applySettlement,
  mergeProgress,
  object,
  parsePlayerFile,
  parseUser,
  validId,
  type PlayerFile,
} from '../src/features/players/schema.ts'

const PREFIX = '/__player-data'
const httpError = (status: number, message: string) => Object.assign(new Error(message), { status })
const missing = (error: unknown) => object(error) && error.code === 'ENOENT'

export function createPlayerRepository(directory: string) {
  let tail = Promise.resolve()
  const serialized = <T>(action: () => Promise<T>): Promise<T> => {
    const result = tail.then(action)
    tail = result.then(
      () => {},
      () => {},
    )
    return result
  }
  const filePath = (id: string) => {
    if (!validId(id)) throw httpError(400, '玩家 ID 无效')
    return join(directory, `${id}.json`)
  }
  async function checkDirectory() {
    await mkdir(directory, { recursive: true })
    if ((await lstat(directory)).isSymbolicLink()) throw new Error('存档目录不能是符号链接')
  }
  async function read(id: string): Promise<PlayerFile> {
    await checkDirectory()
    const path = filePath(id)
    try {
      if ((await lstat(path)).isSymbolicLink()) throw new Error('存档文件不能是符号链接')
      const file = parsePlayerFile(JSON.parse(await readFile(path, 'utf8')))
      if (file.player.id !== id) throw new Error('存档文件名与玩家 ID 不一致')
      return file
    } catch (error) {
      if (missing(error)) throw httpError(404, '玩家存档不存在')
      throw new Error(
        `玩家 ${id} 的存档无法读取，原文件已保留。${error instanceof Error ? error.message : ''}`,
        { cause: error },
      )
    }
  }
  async function list(): Promise<PlayerFile[]> {
    await checkDirectory()
    const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort()
    return Promise.all(names.map((name) => read(name.slice(0, -5))))
  }
  async function write(file: PlayerFile) {
    const valid = parsePlayerFile(file)
    const path = filePath(valid.player.id)
    const temporary = join(directory, `.${valid.player.id}-${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, JSON.stringify(valid, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
      await rename(temporary, path)
    } finally {
      await rm(temporary, { force: true })
    }
    return valid
  }
  async function uniqueName(name: string, id?: string) {
    const duplicate = (await list()).find(
      (file) =>
        file.player.id !== id &&
        !file.archived &&
        file.player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    if (duplicate) throw httpError(409, '已有同名玩家，请选择已有档案，或使用不同名称')
  }
  return {
    list,
    read,
    create: (input: unknown) =>
      serialized(async () => {
        if (!object(input)) throw httpError(400, '玩家资料无效')
        const player = parseUser({
          id: randomUUID(),
          name: input.name,
          avatar: input.avatar ?? 'default',
          createdAt: new Date().toISOString(),
        })
        await uniqueName(player.name)
        return write({ version: 1, player, games: {} })
      }),
    settle: (id: string, input: unknown) =>
      serialized(async () => {
        const file = await read(id)
        if (file.archived) throw httpError(409, '玩家已归档，请重新选择玩家')
        const next = applySettlement(file, input)
        return next === file ? file : write(next)
      }),
    archive: (id: string) => serialized(async () => write({ ...(await read(id)), archived: true })),
    import: (input: unknown, guest = false) =>
      serialized(async () => {
        const incoming = parsePlayerFile(input)
        let existing: PlayerFile | undefined
        try {
          existing = await read(incoming.player.id)
        } catch (error) {
          if (!object(error) || error.status !== 404) throw error
        }
        if (guest && !existing) throw httpError(404, '请先创建并选择归属玩家')
        if (existing?.archived) throw httpError(409, '该玩家已归档，旧数据保留在浏览器中')
        if (guest ? existing?.guestImported : existing?.legacyImported) return existing!
        await uniqueName(incoming.player.name, incoming.player.id)
        let next = existing ?? { version: 1 as const, player: incoming.player, games: {} }
        for (const [gameId, game] of Object.entries(incoming.games)) {
          const current = next.games[gameId] ?? { progress: {}, records: [] }
          next = {
            ...next,
            games: {
              ...next.games,
              [gameId]: {
                progress: mergeProgress(current.progress, game.progress),
                records: current.records,
              },
            },
          }
          for (const record of game.records) next = applySettlement(next, { record, progress: {} })
        }
        return write({ ...next, [guest ? 'guestImported' : 'legacyImported']: true })
      }),
  }
}

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json'))
    throw httpError(415, '请求必须为 JSON')
  const buffers: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 5 * 1024 * 1024) throw httpError(413, '存档请求超过 5 MB，请拆分导入')
    buffers.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(buffers).toString('utf8'))
  } catch {
    throw httpError(400, 'JSON 格式不正确')
  }
}

export function createPlayerMiddleware(directory: string) {
  const repository = createPlayerRepository(directory)
  return (request: IncomingMessage, response: ServerResponse, next: () => void) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    if (!pathname.startsWith(PREFIX + '/')) return next()
    const send = (status: number, data: unknown) => {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      response.end(JSON.stringify(data))
    }
    void (async () => {
      const host = request.headers.host ?? ''
      const hostname = new URL(`http://${host}`).hostname
      if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname))
        throw httpError(403, '文件存档接口仅支持本机访问')
      if (request.headers.origin && new URL(request.headers.origin).host !== host)
        throw httpError(403, '不允许跨站访问文件存档')
      const parts = pathname.slice(PREFIX.length).split('/').filter(Boolean)
      if (parts[0] !== 'players') throw httpError(404, '接口不存在')
      if (request.method === 'GET' && parts.length === 1)
        return send(
          200,
          (await repository.list()).filter((file) => !file.archived),
        )
      if (request.method === 'POST' && parts.length === 1)
        return send(201, await repository.create(await jsonBody(request)))
      if (request.method === 'POST' && parts.length === 2 && parts[1] === 'import')
        return send(200, await repository.import(await jsonBody(request)))
      const id = parts[1]
      if (!validId(id)) throw httpError(400, '缺少有效玩家 ID')
      if (request.method === 'GET' && parts.length === 2)
        return send(200, await repository.read(id))
      if (request.method === 'DELETE' && parts.length === 2)
        return send(200, await repository.archive(id))
      if (request.method === 'POST' && parts.length === 3 && parts[2] === 'settlements')
        return send(200, await repository.settle(id, await jsonBody(request)))
      if (request.method === 'POST' && parts.length === 3 && parts[2] === 'import-guest') {
        const body = parsePlayerFile(await jsonBody(request))
        if (body.player.id !== id) throw httpError(400, '玩家归属不一致')
        return send(200, await repository.import(body, true))
      }
      throw httpError(404, '接口不存在')
    })().catch((error: unknown) =>
      send(object(error) && typeof error.status === 'number' ? error.status : 400, {
        error: error instanceof Error ? error.message : '存档读写失败',
      }),
    )
  }
}

export function playerDataPlugin(): Plugin {
  let directory = ''
  return {
    name: 'player-file-data',
    configResolved(config) {
      directory = resolve(config.root, 'data/players')
    },
    configureServer(server) {
      server.middlewares.use(createPlayerMiddleware(directory))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createPlayerMiddleware(directory))
    },
  }
}
