import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'wordle',
    name: '猜词',
    description: '按字母位置反馈颜色线索。简单 4 字母、中等 5 字母、复杂 6 字母且次数更少。',
    tags: ['文字', '推理'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#89e66d] via-[#36c96d] to-[#38bdf8]',
    icon: '📝',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
