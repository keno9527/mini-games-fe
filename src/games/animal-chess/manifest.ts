import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'animal-chess',
    name: '斗兽棋',
    description: '双人轮流行棋，以强吃弱、鼠克象；占领对方兽穴或吃光对手即可获胜。',
    tags: ['双人', '策略'],
    difficulties: ['本地双人'],
  },
  presentation: {
    coverGradient: 'from-[#d8b765] via-[#76975a] to-[#315d56]',
    icon: '🐾',
    badge: '双人',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
