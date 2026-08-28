import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'tetris',
    name: '俄罗斯方块',
    description: '下落方块，旋转拼消。方向键平移/旋转/加速，空格硬降。三档对应起始速度与加速节奏。',
    tags: ['经典', '消除'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#576dff] via-[#7d42e8] to-[#ff5aa5]',
    icon: '🧱',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
