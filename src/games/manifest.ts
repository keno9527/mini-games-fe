import type { ComponentType } from 'react'
import type { Game } from '@/types'

export interface GameComponentProps {
  userId?: string
  gameId: string
}

export interface GamePresentation {
  coverGradient: string
  icon: string
}

export interface GameModule {
  default: ComponentType<GameComponentProps>
}

export interface GameManifest {
  game: Game
  presentation: GamePresentation
  load: () => Promise<GameModule>
}
