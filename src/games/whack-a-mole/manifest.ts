import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'whack-a-mole',
    name: '打地鼠',
    description: '限时点击地鼠。三档难度对应洞数、时长与出现速度。',
    tags: ['反应', '休闲'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#a9ef73] via-[#5eca51] to-[#ffd45a]',
    icon: '🐹',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
