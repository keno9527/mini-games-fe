import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'gomoku',
    name: '五子棋',
    description: '15×15 自由五子棋，保留三档人机对战；30 关残局挑战，从一步成五到五步连续冲四。',
    tags: ['对战', '策略'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#f5d59b] via-[#d2a96b] to-[#9f7848]',
    icon: '⚫',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
