import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGames, getPlayRanking } from '../api'
import GameCard from '../components/GameCard'
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
      .catch(() => setError('无法连接后端服务，请先启动 server-go'))
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
    <main className="max-w-7xl mx-auto px-6 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-5xl mb-4 select-none">🎉 🎮 🎊</div>
        <h1 className="text-5xl md:text-6xl font-black text-fun-text mb-3 leading-tight">
          欢迎来到{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fun-accent via-fun-pink to-fun-purple">
            游戏大厅
          </span>
          ！
        </h1>
        <p className="text-fun-muted text-lg font-semibold">
          快来选一个游戏开始玩吧 ✨
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-fun-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-fun-muted font-semibold">加载中...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-20 bg-red-50 rounded-3xl border-2 border-red-200">
          <div className="text-4xl mb-3">😅</div>
          <p className="text-red-500 font-bold mb-2">{error}</p>
          <code className="text-xs text-fun-muted bg-white px-3 py-1.5 rounded-xl border border-fun-border font-mono">
            cd server-go && go run .
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
                  className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-colors ${
                    activeTag === tag
                      ? 'bg-fun-accent text-white border-fun-accent'
                      : 'bg-white text-fun-muted border-fun-border hover:border-fun-accent hover:text-fun-accent'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-fun-text flex items-center gap-2">
                🕹️ {activeTag === '全部' ? '全部游戏' : activeTag}
              </h2>
              <span className="text-sm font-bold text-fun-muted bg-fun-border px-3 py-1 rounded-full">
                {filteredGames.length} 款好玩的
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
            <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-6 sticky top-6">
              <h3 className="text-lg font-black text-fun-text flex items-center gap-2 mb-4">
                🔥 最近热玩
              </h3>
              {top5.length === 0 ? (
                <p className="text-sm text-fun-muted font-medium text-center py-4">暂无数据</p>
              ) : (
                <ol className="space-y-3">
                  {top5.map((item, idx) => (
                    <li key={item.gameId}>
                      <Link
                        to={`/game/${item.gameId}`}
                        className="flex items-center gap-3 group"
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${
                            idx === 0
                              ? 'bg-yellow-400'
                              : idx === 1
                                ? 'bg-gray-400'
                                : idx === 2
                                  ? 'bg-amber-600'
                                  : 'bg-fun-border text-fun-muted'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-fun-text group-hover:text-fun-accent transition-colors truncate">
                          {item.gameName}
                        </span>
                        <span className="ml-auto text-xs font-bold text-fun-muted shrink-0">
                          {item.playCount} 次
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
