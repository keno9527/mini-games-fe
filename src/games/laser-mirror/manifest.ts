import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'laser-mirror',
    name: '折光回廊',
    description: '旋转镜面、分引光束，在精巧的光学回廊中同时点亮全部水晶。',
    tags: ['解谜', '光学', '关卡'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#071527] via-[#123b5a] to-[#19d3c5]',
    icon: '◇',
    badge: 'NEW',
    variant: 'featured',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
