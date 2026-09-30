import {
  mergeProgress,
  parsePlayerFile,
  parseProgress,
  object,
  validId,
  type PlayerFile,
  type ProgressData,
  type Settlement,
} from '../features/players/schema.ts'

const BASE = '/__player-data/players'
const BACKUP_KEY = 'mini-games-pending-settlements-v1'
const files = new Map<string, PlayerFile>()
// Guest unlocks survive route changes, but are not written to player files.
const guestProgress = new Map<string, ProgressData>()
const listeners = new Set<() => void>()
let state = { saving: 0, pending: 0, error: '', saved: false }
let queue = Promise.resolve()
const pending = new Map<string, Settlement>()
try {
  const stored: unknown = JSON.parse(localStorage.getItem(BACKUP_KEY) ?? '[]')
  if (Array.isArray(stored))
    for (const item of stored) {
      if (
        object(item) &&
        object(item.record) &&
        validId(item.record.id) &&
        validId(item.record.userId)
      )
        pending.set(item.record.id, item as unknown as Settlement)
    }
  state = { ...state, pending: pending.size }
} catch {
  /* Failure backups are optional; the player files remain authoritative. */
}

export function subscribeSaves(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const getSaveState = () => state
function update(values: Partial<typeof state>) {
  state = { ...state, ...values, pending: pending.size }
  for (const listener of listeners) listener()
}
function backup() {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify([...pending.values()]))
  } catch {
    /* Banner remains visible. */
  }
}

export async function fileRequest<T>(path = '', method = 'GET', body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(BASE + path, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  } catch {
    throw new Error('无法连接文件存档服务，请检查本地开发服务后重试')
  }
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('当前页面没有文件存档服务，请在项目目录运行 npm run dev 后访问本地页面')
  const result = await response.json()
  if (!response.ok) throw new Error(result.error ?? '存档读写失败')
  return result as T
}

export function hydratePlayerFile(value: unknown): PlayerFile {
  const file = parsePlayerFile(value)
  files.set(file.player.id, file)
  return file
}
export async function loadPlayerFile(id: string): Promise<PlayerFile> {
  if (!validId(id)) throw new Error('请先选择玩家')
  const file = hydratePlayerFile(await fileRequest(`/${id}`))
  if (file.archived) throw new Error('玩家已归档，请重新选择')
  // Unacknowledged settlements can be retried without losing their in-memory progress.
  for (const item of pending.values())
    if (item.record.userId === id) stageProgress(item.record.gameId, id, item.progress)
  return files.get(id)!
}
export function readPlayerProgress(gameId: string, userId?: string): ProgressData {
  return structuredClone(
    userId ? (files.get(userId)?.games[gameId]?.progress ?? {}) : (guestProgress.get(gameId) ?? {}),
  )
}
/** Stage only in memory. createRecord commits this snapshot when the round settles. */
export function stageProgress(
  gameId: string,
  userId: string | undefined,
  progress: ProgressData,
): void {
  if (userId === undefined && validId(gameId)) {
    guestProgress.set(
      gameId,
      mergeProgress(guestProgress.get(gameId) ?? {}, parseProgress(progress)),
    )
    return
  }
  const file = userId ? files.get(userId) : undefined
  if (!file || !validId(gameId)) throw new Error('请先选择并加载玩家档案')
  const game = file.games[gameId] ?? { progress: {}, records: [] }
  files.set(file.player.id, {
    ...file,
    games: {
      ...file.games,
      [gameId]: {
        ...game,
        progress: mergeProgress(game.progress, parseProgress(progress)),
      },
    },
  })
}

async function send(settlement: Settlement): Promise<void> {
  update({ saving: state.saving + 1 })
  try {
    const result = parsePlayerFile(
      await fileRequest(`/${settlement.record.userId}/settlements`, 'POST', settlement),
    )
    const current = files.get(result.player.id)
    if (current)
      for (const [gameId, game] of Object.entries(current.games)) {
        const saved = result.games[gameId] ?? { progress: {}, records: [] }
        result.games[gameId] = { ...saved, progress: mergeProgress(saved.progress, game.progress) }
      }
    files.set(result.player.id, result)
    pending.delete(settlement.record.id)
    backup()
    update({ error: pending.size ? state.error : '', saved: true })
  } catch (error) {
    update({ error: error instanceof Error ? error.message : '文件保存失败', saved: false })
    throw error
  } finally {
    update({ saving: state.saving - 1 })
  }
}
function enqueue(settlement: Settlement): Promise<void> {
  const task = queue.then(() => send(settlement))
  queue = task.catch(() => {})
  return task
}
export async function commitSettlement(settlement: Settlement): Promise<void> {
  if (!validId(settlement.record.userId)) throw new Error('请先选择玩家')
  pending.set(settlement.record.id, structuredClone(settlement))
  backup()
  update({ saved: false })
  return enqueue(settlement)
}
export async function retrySaves(): Promise<void> {
  for (const settlement of [...pending.values()]) await enqueue(settlement)
}
