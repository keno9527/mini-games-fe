import type { GameManifest } from '@/games/manifest'
import { LEVEL_LAYOUTS } from '../breakout/levels'

export default {
  game: {
    id: 'breakout-mobile',
    name: '打砖块（手机端）',
    description: `为拇指留一块舞台。${LEVEL_LAYOUTS.length} 关竖屏挑战，滑动接球，进度自动保存在当前浏览器。`,
    tags: ['手机竖屏', '免登录', '反应'],
    difficulties: ['关卡挑战'],
  },
  presentation: {
    coverGradient: 'from-[#163a46] via-[#287b87] to-[#efd09c]',
    icon: '📱',
    badge: '手机专属',
    actionLabel: '开始竖屏挑战',
  },
  runtime: { kind: 'embedded', load: () => import('./index.tsx') },
} satisfies GameManifest
