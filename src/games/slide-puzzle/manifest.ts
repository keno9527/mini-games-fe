import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'slide-puzzle',
    name: '数字华容道',
    description: '滑动方块复原顺序。三档对应 3x3、4x4、5x5 盘面。',
    tags: ['益智', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#83d4ff] via-[#54b7f2] to-[#6be57d]',
    icon: '🧩',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
