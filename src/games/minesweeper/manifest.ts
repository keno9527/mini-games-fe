import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'minesweeper',
    name: '扫雷',
    description:
      '静下心，循着数字探明雷区。四章二十关逻辑挑战，循序学习数字、全局与区域推理。支持右键插旗、触屏操作模式与键盘操作。揭开全部安全格即可获胜。',
    tags: ['益智', '闯关'],
    difficulties: ['看懂数字', '线索之间', '纵观全局', '新的线索'],
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
