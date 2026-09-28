import { readPlayerProgress, stageProgress } from '../../api/playerFiles'

export type PuzzleProgress = Record<number, 1 | 2>
const key = (gameId: string, userId?: string) => `${gameId}:puzzles:v1:${userId ?? 'guest'}`

export function parseProgress(value: unknown): PuzzleProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const progress: PuzzleProgress = {}
  for (let id = 1; id <= 30; id++) {
    const medal = (value as Record<number, unknown>)[id]
    if (medal === 1 || medal === 2) progress[id] = medal
  }
  return progress
}

export function readProgress(gameId: string, userId?: string): PuzzleProgress {
  let local: PuzzleProgress = {}
  try {
    local = parseProgress(JSON.parse(localStorage.getItem(key(gameId, userId)) ?? '{}'))
  } catch {
    /* Storage may be disabled. */
  }
  const file = parseProgress(readPlayerProgress(gameId, userId).puzzles)
  for (const [id, medal] of Object.entries(file))
    local[Number(id)] = Math.max(local[Number(id)] ?? 0, medal) as 1 | 2
  return local
}

export function completePuzzle(
  progress: PuzzleProgress,
  id: number,
  independent: boolean,
): PuzzleProgress {
  if (!Number.isInteger(id) || id < 1 || id > 30) return progress
  return { ...progress, [id]: Math.max(progress[id] ?? 0, independent ? 2 : 1) as 1 | 2 }
}

export function saveProgress(
  gameId: string,
  userId: string | undefined,
  progress: PuzzleProgress,
): void {
  let localSaved = false
  try {
    localStorage.setItem(key(gameId, userId), JSON.stringify(progress))
    localSaved = true
  } catch {
    /* Authenticated players can still save to their player file. */
  }
  if (userId) stageProgress(gameId, userId, { puzzles: progress })
  else if (!localSaved) throw new Error('浏览器存储不可用，刷新后进度可能丢失')
}

export function readSelection(gameId: string, userId?: string): number {
  try {
    const id = Number(localStorage.getItem(key(gameId, userId) + ':selected'))
    if (Number.isInteger(id) && id >= 1 && id <= 30) return id
  } catch {
    /* Default to the first unfinished puzzle. */
  }
  const progress = readProgress(gameId, userId)
  return Array.from({ length: 30 }, (_, i) => i + 1).find((id) => !progress[id]) ?? 30
}

export function saveSelection(gameId: string, userId: string | undefined, id: number): void {
  try {
    localStorage.setItem(key(gameId, userId) + ':selected', String(id))
  } catch {
    /* Cursor is optional. */
  }
}
