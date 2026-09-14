export interface LevelResult {
  stars: 1 | 2 | 3
  bestMoves: number
}

export interface LaserProgression {
  unlocked: number
  results: Record<string, LevelResult>
}

const KEY = 'mini-games-laser-mirror'

const emptyProgression = (): LaserProgression => ({ unlocked: 1, results: {} })

export function readProgress(gameId: string, userId?: string): LaserProgression {
  if (typeof window === 'undefined') return emptyProgression()
  try {
    const raw = window.localStorage.getItem(`${KEY}:${gameId}:${userId ?? 'guest'}`)
    if (!raw) return emptyProgression()
    const parsed = JSON.parse(raw) as Partial<LaserProgression>
    const candidates = parsed.results && typeof parsed.results === 'object' ? parsed.results : {}
    const results = Object.fromEntries(
      Object.entries(candidates).flatMap(([levelId, value]) => {
        if (!value || typeof value !== 'object') return []
        const candidate = value as Partial<LevelResult>
        if (![1, 2, 3].includes(Number(candidate.stars)) || !Number.isFinite(candidate.bestMoves)) {
          return []
        }
        return [
          [
            levelId,
            {
              stars: Number(candidate.stars) as 1 | 2 | 3,
              bestMoves: Math.max(0, Math.floor(Number(candidate.bestMoves))),
            },
          ],
        ]
      }),
    )
    return {
      unlocked: Math.max(1, Number.isInteger(parsed.unlocked) ? Number(parsed.unlocked) : 1),
      results,
    }
  } catch {
    return emptyProgression()
  }
}

export function saveProgress(gameId: string, userId: string | undefined, value: LaserProgression) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${KEY}:${gameId}:${userId ?? 'guest'}`, JSON.stringify(value))
  } catch {
    // 存储不可用时仍允许继续游玩。
  }
}

export function recordCompletion(
  progression: LaserProgression,
  levelId: string,
  levelIndex: number,
  moves: number,
  stars: 1 | 2 | 3,
  totalLevels: number,
): LaserProgression {
  const current = progression.results[levelId]
  return {
    unlocked: Math.min(totalLevels, Math.max(progression.unlocked, levelIndex + 2)),
    results: {
      ...progression.results,
      [levelId]: {
        stars: Math.max(current?.stars ?? 0, stars) as 1 | 2 | 3,
        bestMoves: Math.min(current?.bestMoves ?? Number.POSITIVE_INFINITY, moves),
      },
    },
  }
}
