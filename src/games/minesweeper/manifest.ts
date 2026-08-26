import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: 'minesweeper',
    name: '扫雷',
    description: '经典扫雷：左键揭开、右键插旗。含简单、中等、复杂三档盘面与雷数。',
    coverImage: '/covers/minesweeper.svg',
    tags: ['益智', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#c6f4ff] via-[#88d96f] to-[#63b7ff]',
    icon: '💣',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
