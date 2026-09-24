import { CAMPAIGNS, type CampaignId } from './data/campaigns.ts'

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem'>
export type CampaignMode = 'single' | 'coop'
export type CampaignProgress = Record<CampaignMode, number>
const progressKey = (userId: string | undefined, campaignId: CampaignId, mode: CampaignMode) =>
  `mini-games-tank-progress-v1:${mode === 'coop' ? 'coop:' : ''}${campaignId === 'battle-city' ? '' : `${campaignId}:`}${userId ? `user:${userId}` : 'guest'}`
const SELECTED_CAMPAIGN_KEY = 'mini-games-tank-selected-campaign'

export function loadSelectedCampaign(storage?: ProgressStorage): CampaignId {
  try {
    const value = (storage ?? localStorage).getItem(SELECTED_CAMPAIGN_KEY)
    return value === 'tank-a' ? value : 'battle-city'
  } catch {
    return 'battle-city'
  }
}

export function saveSelectedCampaign(campaignId: CampaignId, storage?: ProgressStorage): void {
  try {
    ;(storage ?? localStorage).setItem(SELECTED_CAMPAIGN_KEY, campaignId)
  } catch {
    // Remembering the menu choice is optional when browser storage is unavailable.
  }
}

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
  mode: CampaignMode = 'single',
): number {
  const raw = storage.getItem(progressKey(userId, campaignId, mode))
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
  mode: CampaignMode = 'single',
): void {
  if (!isValidStage(stage, campaignId)) throw new Error('Invalid tank stage')
  let previous = 0
  try {
    previous = loadProgress(userId, storage, campaignId, mode)
  } catch {
    // 损坏的进度可以由本次有效进度恢复；存储不可写时由调用方提示。
  }
  storage.setItem(progressKey(userId, campaignId, mode), JSON.stringify(Math.max(previous, stage)))
}
