import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: 'snake',
    name: '贪吃蛇',
    description: '吃食物变长，别撞墙和自己。三档难度对应不同场地大小与速度。',
    coverImage: '/covers/snake.svg',
    tags: ['休闲', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#9bf171] via-[#5cd45a] to-[#38bdf8]',
    icon: '🐍',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
