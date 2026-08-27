import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'tower-defense',
    name: '绿野防线',
    description: '六种特色守卫、飞行与分裂敌人、可破坏障碍物、三大主动技能，八波挑战守护萝卜！',
    tags: ['塔防', '策略', '保卫萝卜'],
    difficulties: ['守卫战'],
  },
  presentation: {
    coverGradient: 'from-[#315f3d] via-[#73b658] to-[#f2ce61]',
    icon: '♜',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
