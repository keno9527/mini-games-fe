import { readPlayerProgress, stageProgress } from '../../api/playerFiles'
import { chapterUnlocked, completeLevel, parseProgress, type LogicProgress } from './logic'
import { LOGIC_LEVELS } from './levels'

const legacyKey = (userId?: string) => `minesweeper:logic:v1:${userId ?? 'guest'}`

export function readLogicProgress(gameId: string, userId?: string): LogicProgress {
  let progress: LogicProgress = {}
  try {
    progress = parseProgress(localStorage.getItem(legacyKey(userId)))
  } catch {
    /* File saves work without browser storage. */
  }
  const saved = readPlayerProgress(gameId, userId).logic
  if (saved && typeof saved === 'object') {
    for (const level of LOGIC_LEVELS) {
      const medal = (saved as Record<number, unknown>)[level.id]
      if (medal === 1 || medal === 2) progress = completeLevel(progress, level.id, medal === 2)
    }
  }
  return progress
}

export function saveLogicProgress(
  gameId: string,
  userId: string | undefined,
  progress: LogicProgress,
) {
  if (!userId) {
    localStorage.setItem(legacyKey(), JSON.stringify(progress))
    return
  }
  // Numeric medals use the shared monotonic merge: a later assisted win cannot erase a badge.
  stageProgress(gameId, userId, {
    logic: Object.fromEntries(
      Object.entries(progress)
        .filter(([, result]) => result.completed)
        .map(([id, result]) => [id, result.unaided ? 2 : 1]),
    ),
  })
}

export function resumeLogicLevel(progress: LogicProgress): number {
  return (
    LOGIC_LEVELS.find(
      (level) =>
        !progress[level.id]?.completed && chapterUnlocked(Math.floor((level.id - 1) / 5), progress),
    )?.id ?? 20
  )
}
