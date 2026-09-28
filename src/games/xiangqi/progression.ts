import { readPlayerProgress, stageProgress } from '../../api/playerFiles'
import { levels } from './levels'

export type Progress = Record<string, number>

export function readProgress(gameId: string, userId?: string): Progress {
  try {
    const value: unknown = readPlayerProgress(gameId, userId)
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
    stageProgress(gameId, userId, progress)
    return true
  } catch {
    return false
  }
}

export function unlockedLevel(progress: Progress): number {
  const firstIncomplete = levels.findIndex((level) => !progress[level.id])
  return firstIncomplete < 0 ? levels.length - 1 : firstIncomplete
}
