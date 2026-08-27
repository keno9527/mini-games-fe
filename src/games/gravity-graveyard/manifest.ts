import type { GameManifest } from '@/games/manifest.ts'

export default {
  game: {
    id: 'gravity-graveyard',
    name: '引力墓场',
    description: '化身星骸葬仪师，以牵引与斥力改写残骸和敌火的轨道，在三幕宇宙葬仪中作出最终裁决。',
    tags: ['物理', '动作', '策略', '叙事'],
    difficulties: ['葬仪'],
  },
  presentation: {
    coverGradient: 'from-[#050507] via-[#4a111c] to-[#b8914e]',
    icon: '◉',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
