import { levels } from './levels'

export type Progress = Record<string, number>
const key = (gameId: string, userId?: string) =>
  `mini-games-xiangqi-progress:${JSON.stringify([gameId, userId ?? null])}`

export function readProgress(gameId: string, userId?: string): Progress {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key(gameId, userId)) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const progress: Progress = {}
    for (const level of levels) {
      const stars = (value as Progress)[level.id]
      if (Number.isInteger(stars) && stars >= 1 && stars <= 3) progress[level.id] = stars
    }
    return progress
  } catch {
    return {}
  }
}

export function saveProgress(
  gameId: string,
  userId: string | undefined,
  progress: Progress,
): boolean {
  try {
    window.localStorage.setItem(key(gameId, userId), JSON.stringify(progress))
    return true
  } catch {
    return false
  }
}

export function unlockedLevel(progress: Progress): number {
  const firstIncomplete = levels.findIndex((level) => !progress[level.id])
  return firstIncomplete < 0 ? levels.length - 1 : firstIncomplete
}
