import type { LevelData } from '../types.ts'
import { LEVELS } from './levels.ts'
import { TANK_A_TERRAINS } from './tankA.ts'

export type CampaignId = 'battle-city' | 'tank-a'

// Tank A supplies maps only. Keep the existing 20-enemy difficulty curve,
// holding the final wave from stage 35 onward instead of resetting its difficulty.
export const TANK_A_LEVELS: readonly LevelData[] = TANK_A_TERRAINS.map((terrain, index) => ({
  terrain,
  enemyQueue: LEVELS[Math.min(index, LEVELS.length - 1)].enemyQueue,
}))

export const CAMPAIGNS = {
  'battle-city': { label: 'Battle City', levels: LEVELS },
  'tank-a': { label: 'Tank A', levels: TANK_A_LEVELS },
} satisfies Record<CampaignId, { label: string; levels: readonly LevelData[] }>
