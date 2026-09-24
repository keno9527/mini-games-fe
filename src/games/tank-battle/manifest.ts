import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'tank-battle',
    name: '坦克大战',
    description:
      '单人作战或双手柄双人合作，挑战 Battle City 经典 35 关和 Tank A 的 50 关地图，守护老鹰基地。',
    tags: ['动作', '街机', '经典'],
    difficulties: ['经典战役'],
  },
  presentation: {
    coverGradient: 'from-[#151515] via-[#4b5a24] to-[#d7a829]',
    icon: '🛡️',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
