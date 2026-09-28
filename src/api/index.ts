import { gameCatalog, getCatalogGame } from '@/features/games/data'
import { comparePlayTotals } from '@/features/games/playStats'
import { commitSettlement, fileRequest, readPlayerProgress } from './playerFiles'
import { validId, type PlayerFile } from '@/features/players/schema'
import type { Game, User, GameRecord, UserStats, PlayRankItem } from '@/types'

function getGameName(gameId: string) {
  return getCatalogGame(gameId)?.name ?? gameId
}

export const getGames = async (): Promise<Game[]> => gameCatalog
export const getGame = async (id: string): Promise<Game> => {
  const game = getCatalogGame(id)
  if (!game) throw new Error('游戏不存在')
  return game
}
export const getUsers = async (): Promise<User[]> =>
  (await fileRequest<PlayerFile[]>()).map((file) => file.player)

export const createUser = async (name: string, avatar = 'default'): Promise<User> =>
  (await fileRequest<PlayerFile>('', 'POST', { name: name.trim(), avatar })).player

// Archive rather than erase a player's Git-tracked history.
export const deleteUser = async (id: string): Promise<void> => {
  await fileRequest(`/${id}`, 'DELETE')
}

export const getUserStats = async (id: string): Promise<UserStats> => {
  const file = await fileRequest<PlayerFile>(`/${id}`)
  const user = file.player
  if (!user) throw new Error('user not found')

  const records = Object.values(file.games).flatMap((game) => game.records)
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

export const getRecords = async (userId: string): Promise<GameRecord[]> => {
  const file = await fileRequest<PlayerFile>(`/${userId}`)
  return Object.values(file.games)
    .flatMap((game) => game.records)
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt) || a.id.localeCompare(b.id))
}

export const createRecord = async (
  userId: string,
  data: Pick<GameRecord, 'gameId' | 'score' | 'duration' | 'result'> &
    Partial<Pick<GameRecord, 'id' | 'level' | 'campaignId' | 'mode'>>,
): Promise<GameRecord> => {
  if (!validId(userId)) throw new Error('请先选择玩家')
  if (!getCatalogGame(data.gameId)) throw new Error('游戏不存在')
  const record: GameRecord = {
    ...data,
    id: data.id ?? crypto.randomUUID(),
    userId,
    score: Math.max(0, Math.round(data.score)),
    duration: Math.max(0, Math.round(data.duration)),
    playedAt: new Date().toISOString(),
  }
  await commitSettlement({ record, progress: readPlayerProgress(data.gameId, userId) })
  return record
}

export const getPlayRanking = async (): Promise<PlayRankItem[]> => {
  const totals = new Map<string, PlayRankItem>()
  for (const file of await fileRequest<PlayerFile[]>()) {
    for (const [gameId, game] of Object.entries(file.games)) {
      if (!getCatalogGame(gameId) || game.records.length === 0) continue
      const current = totals.get(gameId) ?? {
        gameId,
        gameName: getGameName(gameId),
        playCount: 0,
        totalDuration: 0,
      }
      current.playCount += game.records.length
      current.totalDuration += game.records.reduce((sum, record) => sum + record.duration, 0)
      totals.set(gameId, current)
    }
  }
  return [...totals.values()].sort(
    (a, b) => comparePlayTotals(a, b) || a.gameId.localeCompare(b.gameId),
  )
}
