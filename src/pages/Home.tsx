import { useEffect, useState } from 'react'
import { getGames } from '../api'
import GameCard from '../components/GameCard'
import type { Game } from '../types'

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getGames()
      .then(setGames)
      .catch(() => setError('无法连接后端服务，请先启动 server-go'))
      .finally(() => setLoading(false))
  }, [])

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

      {/* Games grid */}
      {!loading && !error && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-fun-text flex items-center gap-2">
              🕹️ 全部游戏
            </h2>
            <span className="text-sm font-bold text-fun-muted bg-fun-border px-3 py-1 rounded-full">
              {games.length} 款好玩的
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </>
      )}
    </main>
  )
}
