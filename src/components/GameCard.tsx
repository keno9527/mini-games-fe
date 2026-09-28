import GameLaunchLink from '@/components/GameLaunchLink'
import { getGamePresentation } from '@/features/games/catalog'
import {
  ArrowUpRight,
  GameController,
  GridNine,
  Cards,
  Hammer,
  Cube,
  Bomb,
  Lightbulb,
  Target,
  Strategy,
  type Icon,
} from '@phosphor-icons/react'
import type { Game } from '@/types'

const gameIcons: Record<string, Icon> = {
  xiangqi: Strategy,
  gomoku: GridNine,
  memory: Cards,
  'whack-a-mole': Hammer,
  tetris: Cube,
  minesweeper: Bomb,
  'laser-mirror': Lightbulb,
  breakout: Target,
}

interface Props {
  game: Game
}

export function GameIcon({ gameId, size = 30 }: { gameId: string; size?: number }) {
  const Icon = gameIcons[gameId] ?? GameController
  return <Icon size={size} weight="duotone" aria-hidden="true" />
}

export default function GameCard({ game }: Props) {
  const { badge, actionLabel = '开始游戏', variant = 'default' } = getGamePresentation(game.id)
  return (
    <GameLaunchLink gameId={game.id} className={`library-card library-card--${variant}`}>
      <div className="library-card-top">
        <GameIcon gameId={game.id} />
        {badge && <span>{badge}</span>}
      </div>
      <h3>{game.name}</h3>
      <p>{game.description}</p>
      <div className="library-tags">
        {game.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="library-card-action">
        {actionLabel}
        <ArrowUpRight size={18} aria-hidden="true" />
      </div>
    </GameLaunchLink>
  )
}
