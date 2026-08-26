import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: 'breakout',
    name: '打砖块',
    description: '鼠标控制挡板，物理反弹小球清空砖墙。三档对应砖墙行数、挡板大小与球速。',
    coverImage: '/covers/breakout.svg',
    tags: ['反应', '物理'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#4b84ff] via-[#ff5555] to-[#ffd35a]',
    icon: '🏓',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
