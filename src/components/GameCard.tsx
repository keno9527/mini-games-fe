import GameLaunchLink from '@/components/GameLaunchLink'
import { getGamePresentation } from '@/features/games/catalog'
import type { Game } from '@/types'

interface Props {
  game: Game
}

export default function GameCard({ game }: Props) {
  const {
    coverGradient,
    icon,
    badge,
    actionLabel = '开始游戏',
    variant = 'default',
  } = getGamePresentation(game.id)
  const isFeatured = variant === 'featured'
  const cardClassName =
    'group block overflow-hidden rounded-lg border-4 border-white bg-white shadow-[0_4px_0_#9ac6df,0_10px_24px_rgba(34,91,130,0.18)] transition-all duration-150 hover:-translate-y-1 hover:shadow-[0_7px_0_#74a9c8,0_16px_28px_rgba(34,91,130,0.22)]'

  const content = (
    <>
      {/* Cover */}
      <div
        className={`pixel-card-art relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${coverGradient}`}
      >
        {badge && (
          <span className="absolute left-3 top-3 z-10 rounded-md bg-white/95 px-2 py-1 font-pixel text-[8px] text-[#5d3ded] shadow-[0_3px_0_rgba(24,34,95,0.22)]">
            {badge}
          </span>
        )}
        <span className="relative z-10 select-none text-6xl drop-shadow-[0_5px_0_rgba(0,0,0,0.16)]">
          {icon}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="mb-2 truncate font-game text-xl font-black text-[#19314d]">{game.name}</h3>
        <p className="mb-3 min-h-[40px] line-clamp-2 font-game text-sm font-semibold leading-snug text-[#58708b]">
          {game.description}
        </p>
        <div className="mb-4 flex min-h-[24px] flex-wrap gap-2">
          {game.tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-md px-2 py-1 font-game text-xs font-extrabold ${
                isFeatured && tag === '外部游戏'
                  ? 'bg-[#fff2bd] text-[#9a6200]'
                  : 'bg-[#e9f5ff] text-[#2675bd]'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
        <div
          className={`block w-full rounded-lg py-3 text-center font-game text-sm font-black text-white transition-colors ${
            isFeatured
              ? 'bg-[#6d4df6] shadow-[0_4px_0_#3f2aa8] group-hover:bg-[#ff9b2f] group-hover:shadow-[0_4px_0_#b46b00]'
              : 'bg-[#1275ee] shadow-[0_4px_0_#0b4aa2] group-hover:bg-[#14a642] group-hover:shadow-[0_4px_0_#0b6f2d]'
          }`}
        >
          ▶ {actionLabel}
        </div>
      </div>
    </>
  )

  return (
    <GameLaunchLink gameId={game.id} className={cardClassName}>
      {content}
    </GameLaunchLink>
  )
}
