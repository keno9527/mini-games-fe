import { defaultPlayRanking, gameCatalog, getCatalogGame } from '@/features/games/data'
import type { Game, User, GameRecord, UserStats, PlayRankItem } from '@/types'

const USERS_KEY = 'mini-games-local-users'
const RECORDS_KEY = 'mini-games-local-records'

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

function createId(prefix: string) {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getStoredUsers(): User[] {
  return readStorage<User[]>(USERS_KEY, [])
}

function setStoredUsers(users: User[]) {
  writeStorage(USERS_KEY, users)
}

function getStoredRecords(): GameRecord[] {
  return readStorage<GameRecord[]>(RECORDS_KEY, [])
}

function setStoredRecords(records: GameRecord[]) {
  writeStorage(RECORDS_KEY, records)
}

function getGameName(gameId: string) {
  return getCatalogGame(gameId)?.name ?? gameId
}

// Games
export const getGames = async (): Promise<Game[]> => gameCatalog

export const getGame = async (id: string): Promise<Game> => {
  const game = getCatalogGame(id)
  if (!game) throw new Error('game not found')
  return game
}

// Users
export const getUsers = async (): Promise<User[]> => getStoredUsers()

export const createUser = async (name: string, avatar = 'default'): Promise<User> => {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('user name is required')

  const user: User = {
    id: createId('user'),
    name: trimmed,
    avatar,
    createdAt: new Date().toISOString(),
  }
  const users = [...getStoredUsers(), user]
  setStoredUsers(users)
  return user
}

export const deleteUser = async (id: string): Promise<void> => {
  setStoredUsers(getStoredUsers().filter((user) => user.id !== id))
  setStoredRecords(getStoredRecords().filter((record) => record.userId !== id))
}

export const getUserStats = async (id: string): Promise<UserStats> => {
  const user = getStoredUsers().find((item) => item.id === id)
  if (!user) throw new Error('user not found')

  const records = getStoredRecords().filter((record) => record.userId === id)
  const gameStatsById = new Map<
    string,
    {
      gameId: string
      gameName: string
      playCount: number
      bestScore: number
      totalTime: number
    }
  >()

  records.forEach((record) => {
    const current = gameStatsById.get(record.gameId) ?? {
      gameId: record.gameId,
      gameName: getGameName(record.gameId),
      playCount: 0,
      bestScore: 0,
      totalTime: 0,
    }

    current.playCount += 1
    current.totalTime += record.duration
    current.bestScore = Math.max(current.bestScore, record.score)
    gameStatsById.set(record.gameId, current)
  })

  return {
    userId: user.id,
    userName: user.name,
    totalGames: records.length,
    totalTime: records.reduce((sum, record) => sum + record.duration, 0),
    totalScore: records.reduce((sum, record) => sum + record.score, 0),
    gameStats: Array.from(gameStatsById.values()).sort((a, b) => b.playCount - a.playCount),
  }
}

// Records
export const getRecords = async (userId: string): Promise<GameRecord[]> =>
  getStoredRecords().filter((record) => record.userId === userId)

export const createRecord = async (
  userId: string,
  data: { gameId: string; score: number; duration: number; result: GameRecord['result'] },
): Promise<GameRecord> => {
  if (!getStoredUsers().some((user) => user.id === userId)) {
    throw new Error('user not found')
  }
  if (!getCatalogGame(data.gameId)) {
    throw new Error('game not found')
  }

  const record: GameRecord = {
    id: createId('record'),
    userId,
    gameId: data.gameId,
    score: Math.max(0, Math.round(data.score)),
    duration: Math.max(0, Math.round(data.duration)),
    playedAt: new Date().toISOString(),
    result: data.result,
  }
  const records = [...getStoredRecords(), record]
  setStoredRecords(records)
  return record
}

// Ranking
export const getPlayRanking = async (): Promise<PlayRankItem[]> => {
  const countByGame = new Map<string, number>()
  defaultPlayRanking.forEach((item) => {
    countByGame.set(item.gameId, item.playCount)
  })
  getStoredRecords().forEach((record) => {
    countByGame.set(record.gameId, (countByGame.get(record.gameId) ?? 0) + 1)
  })

  return Array.from(countByGame.entries())
    .map(([gameId, playCount]) => ({
      gameId,
      gameName: getGameName(gameId),
      playCount,
    }))
    .sort((a, b) => b.playCount - a.playCount)
}
