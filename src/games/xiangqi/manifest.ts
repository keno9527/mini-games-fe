import type { GameManifest } from '@/games/manifest'

export default {
  game: {
    id: 'xiangqi',
    name: '中国象棋 · 残局闯关',
    description:
      '执红先行，挑战 6 章 30 道精选残局。从两步配合到八步终局，在限定步数内将死或困毙黑方，逐关解锁。支持提示、悔棋与本地进度保存。',
    tags: ['策略', '棋类', '闯关'],
    difficulties: ['配合破阵', '弃子静着', '综合终局'],
  },
  presentation: {
    coverGradient: 'from-[#ecd8ab] via-[#ca9256] to-[#853b30]',
    icon: '♟️',
    badge: '残局挑战',
  },
  runtime: { kind: 'embedded', load: () => import('./index.tsx') },
} satisfies GameManifest
