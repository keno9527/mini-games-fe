import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'minesweeper',
    name: '扫雷',
    description:
      '静下心，循着数字探明雷区。三档经典盘面，首步安全开局；支持右键插旗、触屏操作模式与键盘操作。揭开全部安全格即可获胜。',
    tags: ['益智', '经典'],
    difficulties: ['简单', '中等', '复杂'],
  },
  presentation: {
    coverGradient: 'from-[#e9dfc7] via-[#879883] to-[#2f5146]',
    icon: '💣',
  },
  runtime: {
    kind: 'embedded',
    load: () => import('./index.tsx'),
  },
} satisfies GameManifest
