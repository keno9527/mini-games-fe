import { Link } from 'react-router-dom'
import type { Game } from '../types'

const coverColors: Record<string, string> = {
  minesweeper:   'from-sky-400 to-blue-500',
  snake:         'from-green-400 to-emerald-500',
  '24points':    'from-orange-400 to-pink-500',
  '2048':        'from-yellow-400 to-orange-400',
  memory:        'from-pink-400 to-rose-500',
  'whack-a-mole':'from-lime-400 to-green-500',
}

const coverIcons: Record<string, string> = {
  minesweeper:   '💣',
  snake:         '🐍',
  '24points':    '🃏',
  '2048':        '🔢',
  memory:        '🎴',
  'whack-a-mole':'🐹',
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
      className="group block bg-fun-card border-2 border-fun-border rounded-3xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-200"
    >
      {/* Cover */}
      <div className={`bg-gradient-to-br ${gradient} h-44 flex items-center justify-center relative overflow-hidden`}>
        <span className="text-7xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 select-none drop-shadow-lg">
          {icon}
        </span>
        {/* Difficulty badge */}
        <div className="absolute top-3 right-3 flex flex-wrap gap-1 justify-end max-w-[140px]">
          {levels.map(lv => (
            <span
              key={lv}
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-2 bg-white/90 ${difficultyChip[lv] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
            >
              {lv}
            </span>
          ))}
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
              className="text-xs font-bold px-3 py-1 rounded-full bg-fun-accent/10 text-fun-accent border-2 border-fun-accent/20"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}
