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

export default function GameCard({ game }: Props) {
  const { badge, actionLabel = '开始游戏', variant = 'default' } = getGamePresentation(game.id)
  const CoverIcon = gameIcons[game.id] ?? GameController
  return (
    <GameLaunchLink gameId={game.id} className={`library-card library-card--${variant}`}>
      <div className="library-card-top">
        <CoverIcon size={30} weight="duotone" aria-hidden="true" />
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
