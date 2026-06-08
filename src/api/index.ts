import { games } from '../config/games'
import { defaultRecords } from '../config/records'
import { defaultUsers } from '../config/users'
import type { Game, User, GameRecord, UserStats, PlayRankItem } from '../types'

const STORAGE_KEYS = {
  users: 'mini-game-users',
  records: 'mini-game-records',
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function readStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) as T : clone(defaultValue)
  } catch {
    return clone(defaultValue)
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Keep the app usable even when browser storage is unavailable.
  }
}

function readUsers(): User[] {
  return readStorage<User[]>(STORAGE_KEYS.users, defaultUsers)
}

function readRecords(): GameRecord[] {
  return readStorage<GameRecord[]>(STORAGE_KEYS.records, defaultRecords)
}

function findGameName(gameId: string): string {
  return games.find(g => g.id === gameId)?.name ?? gameId
}

export const getGames = (): Promise<Game[]> =>
  Promise.resolve(clone(games))

export const getGame = (id: string): Promise<Game> => {
  const game = games.find(g => g.id === id)
  if (!game) return Promise.reject(new Error('Game not found'))
  return Promise.resolve(clone(game))
}

export const getUsers = (): Promise<User[]> =>
  Promise.resolve(readUsers())

export const createUser = (name: string, avatar?: string): Promise<User> => {
  const users = readUsers()
  const user: User = {
    id: generateId(),
    name,
    avatar: avatar || name.slice(0, 2).toUpperCase(),
    createdAt: new Date().toISOString(),
  }

  writeStorage(STORAGE_KEYS.users, [...users, user])
  return Promise.resolve(user)
}

export const deleteUser = (id: string): Promise<void> => {
  writeStorage(STORAGE_KEYS.users, readUsers().filter(u => u.id !== id))
  writeStorage(STORAGE_KEYS.records, readRecords().filter(r => r.userId !== id))
  return Promise.resolve()
}

export const getUserStats = (userId: string): Promise<UserStats> => {
  const users = readUsers()
  const records = readRecords().filter(r => r.userId === userId)
  const user = users.find(u => u.id === userId)
  const gameStatsMap = new Map<string, { playCount: number; bestScore: number; totalTime: number }>()

  records.forEach(record => {
    const existing = gameStatsMap.get(record.gameId) ?? { playCount: 0, bestScore: 0, totalTime: 0 }
    existing.playCount += 1
    existing.bestScore = Math.max(existing.bestScore, record.score)
    existing.totalTime += record.duration
    gameStatsMap.set(record.gameId, existing)
  })

  const gameStats = Array.from(gameStatsMap.entries()).map(([gameId, stats]) => ({
    gameId,
    gameName: findGameName(gameId),
    ...stats,
  }))

  return Promise.resolve({
    userId,
    userName: user?.name ?? 'Unknown',
    totalGames: records.length,
    totalTime: records.reduce((sum, r) => sum + r.duration, 0),
    totalScore: records.reduce((sum, r) => sum + r.score, 0),
    gameStats,
  })
}

export const getRecords = (userId: string): Promise<GameRecord[]> => {
  const records = readRecords()
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())

  return Promise.resolve(records)
}

export const createRecord = (
  userId: string,
  data: { gameId: string; score: number; duration: number; result: string }
): Promise<GameRecord> => {
  const record: GameRecord = {
    id: generateId(),
    userId,
    gameId: data.gameId,
    score: data.score,
    duration: data.duration,
    playedAt: new Date().toISOString(),
    result: data.result as GameRecord['result'],
  }

  writeStorage(STORAGE_KEYS.records, [...readRecords(), record])
  return Promise.resolve(record)
}

export const getPlayRanking = (): Promise<PlayRankItem[]> => {
  const playCountMap = new Map<string, number>()

  readRecords().forEach(record => {
    playCountMap.set(record.gameId, (playCountMap.get(record.gameId) ?? 0) + 1)
  })

  const ranking = Array.from(playCountMap.entries())
    .map(([gameId, playCount]) => ({
      gameId,
      gameName: findGameName(gameId),
      playCount,
    }))
    .sort((a, b) => b.playCount - a.playCount)

  return Promise.resolve(ranking)
}
