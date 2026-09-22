import { LEVELS } from './data/levels.ts'

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>
const progressKey = (userId?: string) =>
  `mini-games-tank-progress-v1:${userId ? `user:${userId}` : 'guest'}`

export function isValidStage(stage: unknown): stage is number {
  return typeof stage === 'number' && Number.isInteger(stage) && stage >= 0 && stage < LEVELS.length
}

export function loadProgress(userId?: string, storage: ProgressStorage = localStorage): number {
  const raw = storage.getItem(progressKey(userId))
  if (raw === null) return 0
  const value: unknown = JSON.parse(raw)
  if (!isValidStage(value)) throw new Error('Invalid tank progress')
  return value
}

export function saveProgress(
  stage: number,
  userId?: string,
  storage: ProgressStorage = localStorage,
): void {
  if (!isValidStage(stage)) throw new Error('Invalid tank stage')
  let previous = 0
  try {
    previous = loadProgress(userId, storage)
  } catch {
    // 损坏的进度可以由本次有效进度恢复；存储不可写时由调用方提示。
  }
  storage.setItem(progressKey(userId), JSON.stringify(Math.max(previous, stage)))
}
