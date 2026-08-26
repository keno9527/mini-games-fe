import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: 'memory',
    name: '记忆翻牌',
    description: '翻开找相同一对。三档难度对应不同对数。',
    coverImage: '/covers/memory.svg',
    tags: ['记忆', '益智'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#57b8ff] via-[#786dff] to-[#b66dff]',
    icon: '🎴',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
