import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'snake',
    name: '贪吃蛇',
    description: '探索九关机关花园：收集苹果、寻找钥匙、穿越传送门，带着宝石到家。',
    tags: ['休闲', '闯关'],
    difficulties: ['路线入门', '钥匙花园', '传送奇遇'],
  },
  presentation: {
    coverGradient: 'from-[#9bf171] via-[#5cd45a] to-[#38bdf8]',
    icon: '🐍',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
