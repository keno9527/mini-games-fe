import { Link } from 'react-router-dom'
import type { Game } from '../types'

export const coverColors: Record<string, string> = {
  minesweeper:    'from-crt-cyan to-crt-purple',
  snake:          'from-crt-green to-crt-cyan',
  '24points':     'from-crt-yellow to-crt-pink',
  '2048':         'from-crt-yellow to-crt-pink',
  memory:         'from-crt-pink to-crt-purple',
  'whack-a-mole': 'from-crt-green to-crt-yellow',
  'slide-puzzle': 'from-crt-cyan to-crt-purple',
  'reaction-test':'from-crt-green to-crt-yellow',
  'tic-tac-toe':  'from-crt-purple to-crt-pink',
  tetris:         'from-crt-purple to-crt-pink',
  breakout:       'from-crt-pink to-crt-yellow',
  wordle:         'from-crt-green to-crt-cyan',
  gomoku:         'from-crt-cyan to-crt-purple',
}

export const coverIcons: Record<string, string> = {
  minesweeper:   '💣',
  snake:         '🐍',
  '24points':    '🃏',
  '2048':        '🔢',
  memory:        '🎴',
  'whack-a-mole':'🐹',
  'slide-puzzle': '🧩',
  'reaction-test':'⚡',
  'tic-tac-toe':  '❌',
  tetris:         '🧱',
  breakout:       '🏓',
  wordle:         '📝',
  gomoku:         '⚫',
}

interface Props {
  game: Game
}

export default function GameCard({ game }: Props) {
  const gradient = coverColors[game.id] ?? 'from-crt-purple to-crt-pink'
  const icon = coverIcons[game.id] ?? '🎮'

  return (
    <Link
      to={`/game/${game.id}`}
      className="group block bg-crt-bg-card border-2 border-crt-cyan shadow-crt-card hover:shadow-crt-lift hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150"
    >
      {/* Cover */}
      <div
        className={`bg-gradient-to-br ${gradient} h-32 flex items-center justify-center relative overflow-hidden crt-scanlines`}
      >
        <span className="text-6xl select-none drop-shadow-[0_0_8px_rgba(0,0,0,0.4)]">
          {icon}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-pixel text-[10px] text-crt-cyan mb-2 tracking-wider uppercase truncate">
          {game.name}
        </h3>
        <p className="font-mono-crt text-[14px] text-crt-muted leading-tight line-clamp-2 mb-3 min-h-[36px]">
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1 mb-3 min-h-[20px]">
          {game.tags.map(tag => (
            <span
              key={tag}
              className="font-mono-crt text-[12px] px-1.5 py-0.5 bg-crt-yellow/10 text-crt-yellow border border-crt-yellow leading-none"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="block w-full font-pixel text-[8px] py-2 text-center bg-crt-yellow text-crt-bg-deep shadow-neon-y tracking-[2px]">
          ▶ PLAY NOW
        </div>
      </div>
    </Link>
  )
}
