import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'animal-chess-ai',
    name: '斗兽棋 · 人机版',
    description: '与电脑轮流行棋，同级先手可吃，鼠克象；没有地形限制，吃光对方即可获胜。',
    tags: ['人机', '策略'],
    difficulties: ['简单人机'],
  },
  presentation: {
    coverGradient: 'from-[#eadcaf] via-[#98b785] to-[#315d56]',
    icon: '🐾',
    badge: '人机',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
