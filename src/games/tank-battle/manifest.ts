import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'tank-battle',
    name: '坦克大战',
    description: '重返经典 35 关，守护老鹰基地，击中闪烁坦克获取六种道具，迎战四类敌军。',
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
