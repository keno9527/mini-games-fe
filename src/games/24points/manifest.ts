import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: '24points',
    name: '24点',
    description: '用四张牌凑 24。三档难度对应不同时长挑战。',
    coverImage: '/covers/24points.svg',
    tags: ['益智', '数学'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#8bc8ff] via-[#4f7ce8] to-[#b27cff]',
    icon: '🃏',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
