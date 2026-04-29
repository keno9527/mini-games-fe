import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames, getPlayRanking } from '../api'
import GameCard, { coverColors, coverIcons } from '../components/GameCard'
import { GameCardSkeleton } from '../components/Skeleton'
import type { Game, PlayRankItem } from '../types'

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTag, setActiveTag] = useState('全部')
  const [ranking, setRanking] = useState<PlayRankItem[]>([])
  const [activeRankTab, setActiveRankTab] = useState<'all' | 'week'>('all')

  useEffect(() => {
    getGames()
      .then(setGames)
      .catch(() => setError('CANNOT CONNECT TO SERVER. PLEASE START server-go'))
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
    <main className="max-w-7xl mx-auto px-6 py-6">
      {/* Hero */}
      <div className="text-center mb-8 py-6">
        <h1 className="font-pixel text-3xl md:text-5xl leading-tight tracking-widest mb-4">
          <span className="text-crt-cyan" style={{ textShadow: '0 0 12px #00F0FF' }}>
            GAME
          </span>{' '}
          <span className="text-crt-pink" style={{ textShadow: '0 0 12px #FF2EC8' }}>
            HALL
          </span>
        </h1>
        <p className="font-mono-crt text-crt-green text-lg tracking-widest">
          &gt; INSERT COIN TO PLAY_
          <span className="animate-blink">█</span>
        </p>
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
        <div className="text-center py-16 bg-crt-bg-card border-2 border-crt-pink shadow-crt-card">
          <div className="font-pixel text-2xl text-crt-pink mb-4 tracking-widest" style={{ textShadow: '0 0 10px #FF2EC8' }}>
            ERROR 404
          </div>
          <p className="font-mono-crt text-crt-text text-lg mb-3 tracking-wide">{error}</p>
          <code className="inline-block text-xs text-crt-green bg-black px-4 py-2 border border-crt-green/50 font-mono-crt tracking-wider">
            $ cd server-go && go run .
          </code>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && (
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: games */}
          <div className="flex-1 min-w-0">
            {/* Category tabs */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-4 py-1.5 font-pixel text-[10px] tracking-widest border-2 transition-all ${
                    activeTag === tag
                      ? 'bg-crt-pink text-white border-crt-pink shadow-[0_0_10px_#FF2EC8]'
                      : 'bg-crt-bg-card text-crt-text-dim border-crt-border hover:border-crt-cyan hover:text-crt-cyan'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-pixel text-lg md:text-xl text-crt-cyan tracking-widest" style={{ textShadow: '0 0 8px #00F0FF' }}>
                &gt; {activeTag === '全部' ? 'ALL GAMES' : activeTag}
              </h2>
              <span className="font-mono-crt text-sm text-crt-yellow bg-black px-3 py-1 border border-crt-yellow/50 tracking-widest">
                {filteredGames.length} TITLES
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
          <div className="w-full lg:w-72 shrink-0">
            <div className="bg-crt-bg-card border-2 border-crt-yellow shadow-crt-card p-6 sticky top-6">
              <h3 className="font-pixel text-sm text-crt-yellow tracking-widest mb-4" style={{ textShadow: '0 0 8px #FFE500' }}>
                ★ TOP 5 HOT
              </h3>

              {/* Rank Tabs */}
              <div className="flex items-center gap-2 mb-3">
                {(['all', 'week'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveRankTab(tab)}
                    className={`px-3 py-1 font-pixel text-[8px] tracking-widest border-2 transition-all ${
                      activeRankTab === tab
                        ? 'bg-crt-pink text-white border-crt-pink'
                        : 'bg-transparent text-crt-text-dim border-crt-border hover:border-crt-cyan hover:text-crt-cyan'
                    }`}
                  >
                    {tab === 'all' ? 'ALL' : 'WEEK'}
                  </button>
                ))}
              </div>
              {activeRankTab === 'week' && (
                <p className="font-mono-crt text-[11px] text-crt-text-dim mb-3 leading-snug tracking-wide">
                  &gt; based on all records
                </p>
              )}

              {top5.length === 0 ? (
                <p className="font-mono-crt text-sm text-crt-text-dim text-center py-4 tracking-widest">
                  NO DATA_
                </p>
              ) : (
                <ol className="space-y-3">
                  {top5.map((item, idx) => {
                    const gradient = coverColors[item.gameId] ?? 'from-crt-pink to-crt-purple'
                    const icon = coverIcons[item.gameId] ?? '🎮'
                    return (
                      <li key={item.gameId}>
                        <Link
                          to={`/game/${item.gameId}`}
                          className="flex items-center gap-2 group"
                        >
                          {idx === 0 && (
                            <span className="text-crt-yellow shrink-0" aria-label="champion" style={{ textShadow: '0 0 6px #FFE500' }}>
                              ♛
                            </span>
                          )}
                          <span
                            className={`w-8 h-8 flex items-center justify-center text-base shrink-0 bg-gradient-to-br ${gradient} border border-crt-border`}
                            style={{ imageRendering: 'pixelated' }}
                            aria-hidden
                          >
                            {icon}
                          </span>
                          <span
                            className={`w-5 h-5 flex items-center justify-center font-pixel text-[8px] shrink-0 ${
                              idx === 0
                                ? 'bg-crt-yellow text-black'
                                : idx === 1
                                  ? 'bg-crt-cyan text-black'
                                  : idx === 2
                                    ? 'bg-crt-pink text-white'
                                    : 'bg-crt-border text-crt-text-dim'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-mono-crt text-sm text-crt-text group-hover:text-crt-cyan transition-colors truncate tracking-wide">
                            {item.gameName}
                          </span>
                          <span className="ml-auto font-mono-crt text-xs text-crt-yellow shrink-0 tracking-wider">
                            ×{item.playCount}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
