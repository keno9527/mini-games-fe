import type { GameManifest } from '@/games/manifest'

export default {
  game: {
    id: 'xiangqi',
    name: '中国象棋 · 残局闯关',
    description:
      '执红先行，破解 8 道原创残局。从一步杀到三步连攻，在限定步数内将死或困毙黑方，逐关解锁。支持提示、悔棋与本地进度保存。',
    tags: ['策略', '棋类', '闯关'],
    difficulties: ['一步杀', '两步杀', '三步杀'],
  },
  presentation: {
    coverGradient: 'from-[#ecd8ab] via-[#ca9256] to-[#853b30]',
    icon: '♟️',
    badge: '残局挑战',
  },
  runtime: { kind: 'embedded', load: () => import('./index.tsx') },
} satisfies GameManifest
