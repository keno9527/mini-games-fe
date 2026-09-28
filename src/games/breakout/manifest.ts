import { LEVEL_LAYOUTS } from './levels'
import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'breakout',
    name: '打砖块',
    description: `控制挡板反弹小球，挑战${LEVEL_LAYOUTS.length}个递进关卡。6种道具、自动激光、连锁爆破与连击加分。`,
    tags: ['反应', '物理'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#4b84ff] via-[#ff5555] to-[#ffd35a]',
    icon: '🏓',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
