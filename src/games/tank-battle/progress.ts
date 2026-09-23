import { CAMPAIGNS, type CampaignId } from './data/campaigns.ts'

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>
const progressKey = (userId: string | undefined, campaignId: CampaignId) =>
  `mini-games-tank-progress-v1:${campaignId === 'battle-city' ? '' : `${campaignId}:`}${userId ? `user:${userId}` : 'guest'}`

export function isValidStage(
  stage: unknown,
  campaignId: CampaignId = 'battle-city',
): stage is number {
  return (
    typeof stage === 'number' &&
    Number.isInteger(stage) &&
    stage >= 0 &&
    stage < CAMPAIGNS[campaignId].levels.length
  )
}

export function loadProgress(
  userId?: string,
  storage: ProgressStorage = localStorage,
  campaignId: CampaignId = 'battle-city',
): number {
  const raw = storage.getItem(progressKey(userId, campaignId))
  if (raw === null) return 0
  const value: unknown = JSON.parse(raw)
  if (!isValidStage(value, campaignId)) throw new Error('Invalid tank progress')
  return value
}

export function saveProgress(
  stage: number,
  userId?: string,
  storage: ProgressStorage = localStorage,
  campaignId: CampaignId = 'battle-city',
): void {
  if (!isValidStage(stage, campaignId)) throw new Error('Invalid tank stage')
  let previous = 0
  try {
    previous = loadProgress(userId, storage, campaignId)
  } catch {
    // 损坏的进度可以由本次有效进度恢复；存储不可写时由调用方提示。
  }
  storage.setItem(progressKey(userId, campaignId), JSON.stringify(Math.max(previous, stage)))
}
