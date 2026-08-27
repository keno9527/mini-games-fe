import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'gomoku',
    name: '五子棋',
    description: '15x15 棋盘，你执黑先手。简单随机、中等会守必杀、复杂启用棋形评估。',
    tags: ['对战', '策略'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#f5d59b] via-[#d2a96b] to-[#9f7848]',
    icon: '⚫',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
