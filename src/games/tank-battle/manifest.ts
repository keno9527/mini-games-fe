import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'tank-battle',
    name: '坦克大战',
    description: '守住老鹰基地，驾驶坦克突破砖墙与钢墙，迎战五关逐步升级的敌军攻势。',
    tags: ['动作', '街机', '经典'],
    difficulties: ['经典战役'],
  },
  presentation: {
    coverGradient: 'from-[#151515] via-[#4b5a24] to-[#d7a829]',
    icon: '🛡️',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
