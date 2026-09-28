import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'breakout',
    name: '打砖块',
    description: '选择关卡击碎砖墙，失败可重试当前关。支持绘制、保存和试玩专属关卡。',
    tags: ['反应', '物理'],
    difficulties: ['关卡挑战', '自定义关卡'],
  },
  presentation: {
    coverGradient: 'from-[#4b84ff] via-[#ff5555] to-[#ffd35a]',
    icon: '🏓',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
