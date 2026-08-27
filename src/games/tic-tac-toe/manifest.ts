import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'tic-tac-toe',
    name: '井字棋',
    description: '先手 X 对战电脑 O。简单随机、中等会堵、复杂为极小化极大最优走法。',
    tags: ['益智', '对战'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#a6dcff] via-[#6db9ff] to-[#ffe56b]',
    icon: '❌',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
