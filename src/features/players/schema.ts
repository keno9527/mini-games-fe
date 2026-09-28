import type { GameRecord, User } from '../../types/index.ts'

export type ProgressData = Record<string, unknown>
export interface PlayerGame {
  progress: ProgressData
  records: GameRecord[]
}
export interface PlayerFile {
  version: 1
  player: User
  games: Record<string, PlayerGame>
  archived?: boolean
  legacyImported?: boolean
  guestImported?: boolean
}
export interface Settlement {
  record: GameRecord
  progress: ProgressData
}

export const validId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(value) &&
  !['constructor', 'prototype', '__proto__'].includes(value)

export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function fail(message: string): never {
  throw new Error(message)
}

export function parseUser(value: unknown): User {
  if (!object(value) || !validId(value.id)) fail('玩家 ID 无效')
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 20)
    fail('玩家名称需为 1–20 个字符')
  if (typeof value.avatar !== 'string' || value.avatar.length > 100) fail('头像格式无效')
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)))
    fail('玩家创建时间无效')
  return { id: value.id, name: value.name.trim(), avatar: value.avatar, createdAt: value.createdAt }
}

export function parseRecord(value: unknown, playerId: string): GameRecord {
  if (!object(value) || !validId(value.id) || !validId(value.gameId)) fail('记录 ID 无效')
  if (value.userId !== playerId) fail('记录不属于当前玩家')
  if (!Number.isSafeInteger(value.score) || Number(value.score) < 0) fail('分数无效')
  if (!Number.isSafeInteger(value.duration) || Number(value.duration) < 0) fail('游玩时长无效')
  if (!['win', 'lose', 'complete'].includes(String(value.result))) fail('结算结果无效')
  if (typeof value.playedAt !== 'string' || !Number.isFinite(Date.parse(value.playedAt)))
    fail('结算时间无效')
  if (value.level !== undefined && (!Number.isSafeInteger(value.level) || Number(value.level) < 1))
    fail('关卡无效')
  if (value.campaignId !== undefined && !validId(value.campaignId)) fail('战役无效')
  if (value.mode !== undefined && !['single', 'coop', 'practice'].includes(String(value.mode)))
    fail('游戏模式无效')
  return {
    id: value.id,
    userId: playerId,
    gameId: value.gameId,
    score: Number(value.score),
    duration: Number(value.duration),
    result: value.result as GameRecord['result'],
    playedAt: value.playedAt,
    ...(value.level === undefined ? {} : { level: Number(value.level) }),
    ...(value.campaignId === undefined ? {} : { campaignId: String(value.campaignId) }),
    ...(value.mode === undefined ? {} : { mode: value.mode as GameRecord['mode'] }),
  }
}

/** Only JSON data is accepted; keys are checked before any merge or filesystem operation. */
export function parseProgress(value: unknown, depth = 0): ProgressData {
  if (!object(value) || depth > 8) fail('进度格式无效')
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key) || key.length > 120)
      fail('进度字段无效')
    if (object(item)) parseProgress(item, depth + 1)
    else if (Array.isArray(item)) {
      if (
        item.length > 2000 ||
        !item.every((entry) => typeof entry === 'string' && entry.length <= 200)
      )
        fail('解锁列表格式无效')
    } else if (!(
      typeof item === 'string' ||
      typeof item === 'boolean' ||
      item === null ||
      (typeof item === 'number' && Number.isFinite(item) && item >= 0)
    ))
      fail('进度字段值无效')
  }
  return structuredClone(value)
}

/** Best results and unlocks never regress when two local tabs settle in a different order. */
export function mergeProgress(previous: ProgressData, incoming: ProgressData): ProgressData {
  const merged = { ...previous }
  for (const [key, value] of Object.entries(incoming)) {
    const old = merged[key]
    if (object(value) && object(old)) merged[key] = mergeProgress(old, value)
    else if (Array.isArray(value) && Array.isArray(old))
      merged[key] = [...new Set([...old, ...value])]
    else if (typeof value === 'number' && typeof old === 'number')
      merged[key] =
        key === 'bestMoves'
          ? Math.min(old, value)
          : key === 'lastPlayedLevel'
            ? value
            : Math.max(old, value)
    else merged[key] = structuredClone(value)
  }
  return merged
}

export function parsePlayerFile(value: unknown): PlayerFile {
  if (!object(value) || value.version !== 1 || !object(value.games)) fail('存档版本或结构无效')
  const player = parseUser(value.player)
  const games: Record<string, PlayerGame> = {}
  const recordIds = new Set<string>()
  for (const [gameId, game] of Object.entries(value.games)) {
    if (!validId(gameId) || !object(game) || !Array.isArray(game.records)) fail('游戏存档结构无效')
    const records = game.records.map((entry) => {
      const record = parseRecord(entry, player.id)
      if (record.gameId !== gameId || recordIds.has(record.id)) fail('游戏记录归属或 ID 重复')
      recordIds.add(record.id)
      return record
    })
    games[gameId] = { progress: parseProgress(game.progress), records }
  }
  return {
    version: 1,
    player,
    games,
    ...(value.archived === true ? { archived: true } : {}),
    ...(value.legacyImported === true ? { legacyImported: true } : {}),
    ...(value.guestImported === true ? { guestImported: true } : {}),
  }
}

export function applySettlement(file: PlayerFile, input: unknown): PlayerFile {
  if (!object(input)) fail('缺少结算数据')
  const record = parseRecord(input.record, file.player.id)
  const progress = parseProgress(input.progress)
  const existing = Object.values(file.games)
    .flatMap((game) => game.records)
    .find((r) => r.id === record.id)
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(record)) fail('记录 ID 已存在且内容不一致')
    return file
  }
  const game = file.games[record.gameId] ?? { progress: {}, records: [] }
  return {
    ...file,
    games: {
      ...file.games,
      [record.gameId]: {
        progress: mergeProgress(game.progress, progress),
        records: [...game.records, record],
      },
    },
  }
}
