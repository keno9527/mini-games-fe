import { readPlayerProgress, stageProgress } from '../../api/playerFiles'
import { object } from '../../features/players/schema'
import { levels } from './levels'

export interface LevelResult {
  medal: 1 | 2
  bestMoves: number
}
export type Progress = Record<string, LevelResult>

export function readProgress(gameId: string, userId?: string): Progress {
  const saved = readPlayerProgress(gameId, userId).adventure
  if (!object(saved) || !object(saved.results)) return {}
  const progress: Progress = {}
  for (const level of levels) {
    const value = saved.results[level.id]
    if (
      object(value) &&
      (value.medal === 1 || value.medal === 2) &&
      Number.isSafeInteger(value.bestMoves) &&
      Number(value.bestMoves) > 0
    ) {
      progress[level.id] = { medal: value.medal, bestMoves: Number(value.bestMoves) }
    }
  }
  return progress
}

export function unlockedLevel(progress: Progress): number {
  const index = levels.findIndex((level) => !progress[level.id])
  return index < 0 ? levels.length - 1 : index
}

export function recordCompletion(
  progress: Progress,
  levelId: string,
  moves: number,
  gem: boolean,
): Progress {
  const previous = progress[levelId]
  return {
    ...progress,
    [levelId]: {
      medal: Math.max(previous?.medal ?? 0, gem ? 2 : 1) as 1 | 2,
      bestMoves: Math.min(previous?.bestMoves ?? Infinity, moves),
    },
  }
}

export function saveProgress(gameId: string, userId: string | undefined, progress: Progress) {
  // Numeric medals merge monotonically; bestMoves uses the shared minimum merge rule.
  stageProgress(gameId, userId, { adventure: { results: progress } })
}
