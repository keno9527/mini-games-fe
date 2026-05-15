import type { Game, User, GameRecord, UserStats, PlayRankItem } from '../types'

const STORAGE_KEYS = {
  users: 'mini-game-users',
  records: 'mini-game-records',
}

const mockGames: Game[] = [
  {
    id: 'minesweeper',
    name: '💣 扫雷',
    description: '经典扫雷游戏，找出所有隐藏的地雷！左键揭开格子，右键标记地雷。',
    coverImage: '/covers/minesweeper.svg',
    tags: ['益智', '策略'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'snake',
    name: '🐍 贪吃蛇',
    description: '控制蛇吃掉食物，躲避自己的身体！越长越有挑战性。',
    coverImage: '/covers/snake.svg',
    tags: ['经典', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: '24points',
    name: '🃏 24点',
    description: '使用加减乘除运算，将四个数字组合得到24！锻炼数学思维。',
    coverImage: '/covers/24points.svg',
    tags: ['益智', '数学'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: '2048',
    name: '🔢 2048',
    description: '滑动方块，合并相同数字，目标是达到2048！',
    coverImage: '/covers/2048.svg',
    tags: ['益智', '策略'],
    difficulties: ['简单', '中等'],
  },
  {
    id: 'memory',
    name: '🧠 记忆翻牌',
    description: '翻开卡片找到配对的图案，考验你的记忆力！',
    coverImage: '/covers/memory.svg',
    tags: ['益智', '记忆'],
    difficulties: ['简单', '中等'],
  },
  {
    id: 'whack-a-mole',
    name: '🔨 打地鼠',
    description: '快速点击冒出来的地鼠，争取最高分！',
    coverImage: '/covers/whackamole.svg',
    tags: ['反应', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'slide-puzzle',
    name: '🧩 滑块拼图',
    description: '移动方块还原图片，挑战你的空间思维！',
    coverImage: '/covers/slide-puzzle.svg',
    tags: ['益智', '拼图'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'reaction-test',
    name: '⚡ 反应测试',
    description: '测试你的反应速度，看看你能多快点击！',
    coverImage: '/covers/reaction-test.svg',
    tags: ['反应', '测试'],
    difficulties: ['简单'],
  },
  {
    id: 'tic-tac-toe',
    name: '⭕ 井字棋',
    description: '经典的三连棋游戏，与AI对战！',
    coverImage: '/covers/tic-tac-toe.svg',
    tags: ['经典', '对战'],
    difficulties: ['简单', '中等'],
  },
  {
    id: 'tetris',
    name: '🧱 俄罗斯方块',
    description: '经典俄罗斯方块，堆叠方块消除行！',
    coverImage: '/covers/tetris.svg',
    tags: ['经典', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'breakout',
    name: '🎮 打砖块',
    description: '控制挡板反弹小球，打破所有砖块！',
    coverImage: '/covers/breakout.svg',
    tags: ['经典', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  {
    id: 'wordle',
    name: '🔤 Wordle',
    description: '猜单词游戏，每天一个新挑战！',
    coverImage: '/covers/wordle.svg',
    tags: ['益智', '文字'],
    difficulties: ['中等'],
  },
  {
    id: 'gomoku',
    name: '⚫ 五子棋',
    description: '经典五子棋，连成五子获胜！',
    coverImage: '/covers/gomoku.svg',
    tags: ['策略', '对战'],
    difficulties: ['简单', '中等', '复杂'],
  },
]

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  } catch {
    return defaultValue
  }
}

function setStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// Games
export const getGames = (): Promise<Game[]> =>
  Promise.resolve(mockGames)

export const getGame = (id: string): Promise<Game> => {
  const game = mockGames.find(g => g.id === id)
  if (!game) {
    return Promise.reject(new Error('Game not found'))
  }
  return Promise.resolve(game)
}

// Users
export const getUsers = (): Promise<User[]> =>
  Promise.resolve(getStorage<User[]>(STORAGE_KEYS.users, []))

export const createUser = (name: string, avatar?: string): Promise<User> => {
  const users = getStorage<User[]>(STORAGE_KEYS.users, [])
  const user: User = {
    id: generateId(),
    name,
    avatar: avatar || '',
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  setStorage(STORAGE_KEYS.users, users)
  return Promise.resolve(user)
}

export const deleteUser = (id: string): Promise<void> => {
  const users = getStorage<User[]>(STORAGE_KEYS.users, []).filter(u => u.id !== id)
  setStorage(STORAGE_KEYS.users, users)
  const records = getStorage<GameRecord[]>(STORAGE_KEYS.records, []).filter(r => r.userId !== id)
  setStorage(STORAGE_KEYS.records, records)
  return Promise.resolve()
}

export const getUserStats = (userId: string): Promise<UserStats> => {
  const records = getStorage<GameRecord[]>(STORAGE_KEYS.records, []).filter(r => r.userId === userId)
  const user = getStorage<User[]>(STORAGE_KEYS.users, []).find(u => u.id === userId)
  
  const gameStatsMap = new Map<string, { playCount: number; bestScore: number; totalTime: number }>()
  
  records.forEach(record => {
    const existing = gameStatsMap.get(record.gameId) || { playCount: 0, bestScore: 0, totalTime: 0 }
    existing.playCount++
    existing.bestScore = Math.max(existing.bestScore, record.score)
    existing.totalTime += record.duration
    gameStatsMap.set(record.gameId, existing)
  })
  
  const gameStats = Array.from(gameStatsMap.entries()).map(([gameId, stats]) => {
    const game = mockGames.find(g => g.id === gameId)
    return {
      gameId,
      gameName: game?.name || gameId,
      ...stats,
    }
  })
  
  const totalGames = records.length
  const totalScore = records.reduce((sum, r) => sum + r.score, 0)
  const totalTime = records.reduce((sum, r) => sum + r.duration, 0)
  
  return Promise.resolve({
    userId,
    userName: user?.name || 'Unknown',
    totalGames,
    totalTime,
    totalScore,
    gameStats,
  })
}

// Records
export const getRecords = (userId: string): Promise<GameRecord[]> => {
  const records = getStorage<GameRecord[]>(STORAGE_KEYS.records, []).filter(r => r.userId === userId)
  return Promise.resolve(records.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()))
}

export const createRecord = (
  userId: string,
  data: { gameId: string; score: number; duration: number; result: string }
): Promise<GameRecord> => {
  const records = getStorage<GameRecord[]>(STORAGE_KEYS.records, [])
  const record: GameRecord = {
    id: generateId(),
    userId,
    gameId: data.gameId,
    score: data.score,
    duration: data.duration,
    playedAt: new Date().toISOString(),
    result: data.result as 'win' | 'lose' | 'complete',
  }
  records.push(record)
  setStorage(STORAGE_KEYS.records, records)
  return Promise.resolve(record)
}

// Ranking
export const getPlayRanking = (): Promise<PlayRankItem[]> => {
  const records = getStorage<GameRecord[]>(STORAGE_KEYS.records, [])
  const playCountMap = new Map<string, number>()
  
  records.forEach(record => {
    playCountMap.set(record.gameId, (playCountMap.get(record.gameId) || 0) + 1)
  })
  
  const ranking = Array.from(playCountMap.entries())
    .map(([gameId, playCount]) => {
      const game = mockGames.find(g => g.id === gameId)
      return {
        gameId,
        gameName: game?.name || gameId,
        playCount,
      }
    })
    .sort((a, b) => b.playCount - a.playCount)
  
  return Promise.resolve(ranking)
}