import { Link } from 'react-router-dom'
import type { Game } from '../types'

export const coverColors: Record<string, string> = {
  minesweeper:   'from-sky-400 to-blue-500',
  snake:         'from-green-400 to-emerald-500',
  '24points':    'from-orange-400 to-pink-500',
  '2048':        'from-yellow-400 to-orange-400',
  memory:        'from-pink-400 to-rose-500',
  'whack-a-mole':'from-lime-400 to-green-500',
  'slide-puzzle': 'from-cyan-400 to-blue-500',
  'reaction-test':'from-lime-400 to-yellow-500',
  'tic-tac-toe':  'from-violet-400 to-indigo-500',
  tetris:         'from-indigo-400 to-blue-600',
  breakout:       'from-red-400 to-orange-500',
  wordle:         'from-emerald-400 to-teal-500',
  gomoku:         'from-stone-400 to-gray-600',
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

const difficultyChip: Record<string, string> = {
  简单: 'bg-green-100 text-green-700 border-green-200',
  中等: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  复杂: 'bg-red-100 text-red-600 border-red-200',
}

interface Props {
  game: Game
}

export default function GameCard({ game }: Props) {
  const gradient = coverColors[game.id] ?? 'from-fun-purple to-fun-pink'
  const icon = coverIcons[game.id] ?? '🎮'
  const levels = game.difficulties?.length ? game.difficulties : ['简单', '中等', '复杂']

  return (
    <Link
      to={`/game/${game.id}`}
      className="group block bg-fun-card border-2 border-fun-border rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover hover:shadow-2xl hover:-translate-y-1 transition-all transition-shadow duration-200"
    >
      {/* Cover */}
      <div className={`bg-gradient-to-br ${gradient} h-44 flex items-center justify-center relative overflow-hidden`}>
        <span className="text-7xl group-hover:scale-105 transition-transform duration-300 select-none drop-shadow-lg">
          {icon}
        </span>
        {/* Difficulty badge */}
        <div className="absolute top-3 right-3 flex flex-wrap gap-1 justify-end max-w-[140px]">
          <span className="bg-white/80 text-fun-text text-xs font-bold px-2 py-1 rounded-full">
            3 档可选
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-5">
        <h3 className="text-xl font-black text-fun-text mb-1.5 group-hover:text-fun-accent transition-colors">
          {game.name}
        </h3>
        <p className="text-sm text-fun-muted leading-relaxed line-clamp-2 mb-3 font-medium">
          {game.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {game.tags.map(tag => (
            <span
              key={tag}
              className="text-xs font-bold px-3 py-1 rounded-full bg-fun-border text-fun-muted border-2 border-fun-accent/20"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
