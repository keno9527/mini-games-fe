import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames, getPlayRanking } from '../api'
import GameCard from '../components/GameCard'
import { GameCardSkeleton } from '../components/Skeleton'
import { getGamePresentation, getGameTarget } from '../features/games/catalog'
import type { Game, PlayRankItem } from '../types'

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTag, setActiveTag] = useState('全部')
  const [ranking, setRanking] = useState<PlayRankItem[]>([])

  useEffect(() => {
    getGames()
      .then(setGames)
      .catch(() => setError('本地游戏配置读取失败，请刷新页面重试'))
      .finally(() => setLoading(false))
    getPlayRanking()
      .then(setRanking)
      .catch(() => {})
  }, [])

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    games.forEach(g => g.tags.forEach(t => tagSet.add(t)))
    return ['全部', ...Array.from(tagSet)]
  }, [games])

  const filteredGames = useMemo(() => {
    if (activeTag === '全部') return games
    return games.filter(g => g.tags.includes(activeTag))
  }, [games, activeTag])

  const top5 = ranking.slice(0, 5)

  return (
    <main className="relative mx-auto max-w-7xl px-5 pb-12 pt-7 md:px-6">
      <div className="pixel-hero mb-7 overflow-hidden rounded-lg border-4 border-white bg-[#5fc9ff] px-6 py-7 shadow-[0_5px_0_#94cde7,0_14px_32px_rgba(28,96,142,0.18)] md:px-8">
        <div className="relative z-10 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="mb-3 inline-flex rounded-md bg-white/95 px-3 py-1 font-pixel text-[9px] tracking-wider text-[#0c63bf] shadow-[0_3px_0_rgba(19,86,138,0.18)]">
              MINI GAMES
            </p>
            <h1
              className="font-pixel text-3xl leading-tight text-white md:text-5xl"
              style={{ textShadow: '3px 3px 0 #0b62b8, 6px 6px 0 rgba(0,0,0,0.16)' }}
            >
              游戏广场
            </h1>
            <p className="mt-4 max-w-2xl font-game text-base font-extrabold leading-7 text-[#164976] md:text-lg">
              发现好玩小游戏，挑战高分，冲击排行榜。
            </p>
          </div>
          <div className="hidden min-w-48 justify-self-end md:block">
            <div className="rounded-lg border-4 border-white bg-[#ffd343] px-5 py-4 text-right shadow-[0_5px_0_#bc7a00]">
              <div className="font-pixel text-[10px] leading-5 text-[#15456f]">PLAY NOW</div>
              <div className="mt-2 font-game text-3xl font-black text-[#18324d]">
                {games.length || '--'}
              </div>
              <div className="font-game text-sm font-extrabold text-[#5d6f7e]">款游戏</div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border-4 border-white bg-white px-6 py-14 text-center shadow-[0_5px_0_#9ac6df]">
          <div className="mb-4 font-pixel text-xl tracking-wider text-[#ff4f63]">
            数据加载失败
          </div>
          <p className="mb-3 font-game text-lg font-bold text-[#47637d]">{error}</p>
          <code className="inline-block rounded-md border-2 border-[#7ec7ee] bg-[#eef9ff] px-4 py-2 font-mono-crt text-sm tracking-wider text-[#0c63bf]">
            $ npm run dev
          </code>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left: games */}
          <div className="min-w-0">
            {/* Category tabs */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`rounded-md border-2 px-4 py-2 font-game text-sm font-black transition-all ${
                    activeTag === tag
                      ? 'border-[#b46b00] bg-[#ffd343] text-[#18324d] shadow-[0_4px_0_#b46b00]'
                      : 'border-white bg-white text-[#346887] shadow-[0_3px_0_#b6d8e8] hover:-translate-y-0.5 hover:text-[#0c63bf]'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Header */}
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-game text-2xl font-black text-[#18324d]">
                {activeTag === '全部' ? '游戏列表' : activeTag}
              </h2>
              <span className="rounded-md border-2 border-white bg-white px-3 py-1 font-game text-sm font-black text-[#0c63bf] shadow-[0_3px_0_#b6d8e8]">
                {filteredGames.length} 款
              </span>
            </div>

            {/* Games grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </div>

          {/* Right: ranking sidebar */}
          <aside className="w-full">
            <div className="sticky top-24 rounded-lg border-4 border-white bg-white p-5 shadow-[0_5px_0_#9ac6df,0_12px_24px_rgba(34,91,130,0.16)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="font-game text-xl font-black text-[#18324d]">
                  热门排行榜
                </h3>
                <span className="rounded-md bg-[#e9f5ff] px-2 py-1 font-pixel text-[8px] text-[#0c63bf]">
                  TOP 5
                </span>
              </div>

              {top5.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-[#b6d8e8] bg-[#f4fbff] px-4 py-8 text-center">
                  <p className="font-game text-sm font-extrabold text-[#58708b]">
                    暂无排行记录
                  </p>
                </div>
              ) : (
                <ol className="space-y-3">
                  {top5.map((item, idx) => {
                    const { coverGradient, icon } = getGamePresentation(item.gameId)
                    const target = getGameTarget(item.gameId)
                    const rankingContent = (
                      <>
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-lg ${coverGradient}`}
                          style={{ imageRendering: 'pixelated' }}
                          aria-hidden
                        >
                          {icon}
                        </span>
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-pixel text-[9px] ${
                            idx === 0
                              ? 'bg-[#ffd343] text-[#18324d]'
                              : idx === 1
                                ? 'bg-[#8dd7ff] text-[#18324d]'
                                : idx === 2
                                  ? 'bg-[#ff9b5a] text-white'
                                  : 'bg-[#e9f5ff] text-[#47637d]'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-game text-sm font-black text-[#24435f] transition-colors group-hover:text-[#0c63bf]">
                          {item.gameName}
                        </span>
                        <span className="shrink-0 rounded-md bg-[#edf7e6] px-2 py-1 font-game text-xs font-black text-[#2e8a33]">
                          {item.playCount}
                        </span>
                      </>
                    )
                    const rankingClassName = 'group flex items-center gap-3 rounded-lg border-2 border-[#e5f3fb] bg-[#f7fcff] p-2 transition-all hover:border-[#8fd0f1] hover:bg-white'

                    return (
                      <li key={item.gameId}>
                        {target.isExternal ? (
                          <a
                            href={target.href}
                            target="_blank"
                            rel="noreferrer"
                            className={rankingClassName}
                          >
                            {rankingContent}
                          </a>
                        ) : (
                          <Link to={target.href} className={rankingClassName}>
                            {rankingContent}
                          </Link>
                        )}
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  )
}
