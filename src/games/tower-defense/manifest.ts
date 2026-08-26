import type { GameManifest } from '../manifest.ts'

export default {
  game: {
    id: 'tower-defense',
    name: '绿野防线',
    description: '在蜿蜒的萤石小径旁布置植物守卫，搭配速射、减速与范围炮塔，抵挡五波荒原来客。',
    coverImage: '/covers/tower-defense.svg',
    tags: ['塔防', '策略', '休闲'],
    difficulties: ['守卫战'],
  },
  presentation: {
    coverGradient: 'from-[#315f3d] via-[#73b658] to-[#f2ce61]',
    icon: '♜',
  },
  load: () => import('./index.tsx'),
} satisfies GameManifest
