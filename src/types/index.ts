export interface Game {
  id: string
  name: string
  description: string
  coverImage: string
  tags: string[]
  /** 简单、中等、复杂 */
  difficulties: string[]
}

export interface User {
  id: string
  name: string
  avatar: string
  createdAt: string
}

export interface GameRecord {
  id: string
  userId: string
  gameId: string
  score: number
  duration: number
  playedAt: string
  result: 'win' | 'lose' | 'complete'
}

export interface GameStat {
  gameId: string
  gameName: string
  playCount: number
  bestScore: number
  totalTime: number
}

export interface UserStats {
  userId: string
  userName: string
  totalGames: number
  totalTime: number
  totalScore: number
  gameStats: GameStat[]
}

export interface PlayRankItem {
  gameId: string
  gameName: string
  playCount: number
}
