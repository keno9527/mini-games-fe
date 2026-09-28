import { fileRequest } from '../../api/playerFiles.ts'
import {
  object,
  parsePlayerFile,
  parseProgress,
  parseUser,
  parseRecord,
  type PlayerFile,
  type ProgressData,
} from './schema.ts'
import type { User } from '../../types/index.ts'

function read(key: string, fallback: unknown): unknown {
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`旧存档 ${key} 无法读取，原数据已保留`)
  }
}
export function legacyUsers(): User[] {
  const raw = read('mini-games-local-users', [])
  if (!Array.isArray(raw)) throw new Error('旧玩家列表格式无效，原数据已保留')
  return raw.map(parseUser)
}
export function legacyFile(player: User, guest = false): PlayerFile {
  const file: PlayerFile = { version: 1, player, games: {} }
  const userId = guest ? undefined : player.id
  const add = (gameId: string, value: unknown) => {
    const progress = parseProgress(value)
    if (Object.keys(progress).length) file.games[gameId] = { progress, records: [] }
  }
  add(
    'xiangqi',
    read(`mini-games-xiangqi-progress:${JSON.stringify(['xiangqi', userId ?? null])}`, {}),
  )
  add('laser-mirror', read(`mini-games-laser-mirror:laser-mirror:${userId ?? 'guest'}`, {}))
  const tank: ProgressData = {}
  for (const campaign of ['battle-city', 'tank-a']) {
    const modes: Record<string, number> = {}
    for (const mode of ['single', 'coop']) {
      const key = `mini-games-tank-progress-v1:${mode === 'coop' ? 'coop:' : ''}${campaign === 'battle-city' ? '' : `${campaign}:`}${userId ? `user:${userId}` : 'guest'}`
      const stage = read(key, null)
      if (stage !== null) {
        if (
          !Number.isInteger(stage) ||
          Number(stage) < 0 ||
          Number(stage) >= (campaign === 'battle-city' ? 35 : 50)
        )
          throw new Error('旧坦克关卡进度无效，原数据已保留')
        modes[mode] = Number(stage)
      }
    }
    if (Object.keys(modes).length) tank[campaign] = modes
  }
  add('tank-battle', tank)
  if (guest) add('gravity-graveyard', read('mini-games-local-progression:gravity-graveyard', {}))
  if (!guest) {
    const records = read('mini-games-local-records', [])
    if (!Array.isArray(records)) throw new Error('旧战绩格式无效，原数据已保留')
    for (const item of records)
      if (object(item) && item.userId === player.id) {
        const record = parseRecord(item, player.id)
        const game = file.games[record.gameId] ?? { progress: {}, records: [] }
        game.records.push(record)
        file.games[record.gameId] = game
      }
  }
  return parsePlayerFile(file)
}
export async function importLegacyPlayer(player: User) {
  return fileRequest<PlayerFile>('/import', 'POST', legacyFile(player))
}
export function hasGuestProgress(): boolean {
  try {
    if (localStorage.getItem('mini-games-guest-imported-to')) return false
    const player = {
      id: 'guest-preview',
      name: '游客',
      avatar: 'default',
      createdAt: new Date().toISOString(),
    }
    return Object.keys(legacyFile(player, true).games).length > 0
  } catch {
    return true
  }
}
export async function importGuestProgress(player: User) {
  const result = await fileRequest<PlayerFile>(
    `/${player.id}/import-guest`,
    'POST',
    legacyFile(player, true),
  )
  localStorage.setItem('mini-games-guest-imported-to', player.id)
  return result
}
