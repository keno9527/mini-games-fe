import type { ComponentType } from 'react'
import type { Game } from '@/types'

export interface GameComponentProps {
  userId?: string
  gameId: string
}

export interface GamePresentation {
  coverGradient: string
  icon: string
  badge?: string
  actionLabel?: string
  variant?: 'default' | 'featured'
}

export interface GameModule {
  default: ComponentType<GameComponentProps>
}

export interface EmbeddedGameRuntime {
  kind: 'embedded'
  load: () => Promise<GameModule>
  href?: never
  openIn?: never
}

export interface ExternalGameRuntime {
  kind: 'external'
  href: `https://${string}`
  openIn: 'new-tab'
  load?: never
}

export type GameRuntime = EmbeddedGameRuntime | ExternalGameRuntime

export interface GameManifest {
  game: Game
  presentation: GamePresentation
  runtime: GameRuntime
}
