import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: 'reaction-test',
    name: '反应测试',
    description: '变绿后尽快点击，多回合累计得分。三档对应回合数与惩罚力度。',
    coverImage: '/covers/reaction-test.svg',
    tags: ['反应', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#ffe56b] via-[#ffb84d] to-[#ff6a63]',
    icon: '⚡',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
