import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'breakout',
    name: '打砖块',
    description: '鼠标控制挡板反弹小球，击碎砖墙通关。6种道具、4类砖块、多关卡与连击加分。',
    tags: ['反应', '物理'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#4b84ff] via-[#ff5555] to-[#ffd35a]',
    icon: '🏓',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
