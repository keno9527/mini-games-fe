import { useEffect, useState } from 'react'
import { getGames, getPlayRanking } from '@/api'
import GameCard from '@/components/GameCard'
import GameLaunchLink from '@/components/GameLaunchLink'
import { GameCardSkeleton } from '@/components/Skeleton'
import type { Game, PlayRankItem } from '@/types'

const hiddenGameIds = new Set(['animal-chess', 'whack-a-mole', 'tetris'])

function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
}

export default function Home() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ranking, setRanking] = useState<PlayRankItem[]>([])

  useEffect(() => {
    getGames()
      .then((games) => setGames(games.filter((game) => !hiddenGameIds.has(game.id))))
      .catch(() => setError('本地游戏配置读取失败，请刷新页面重试'))
      .finally(() => setLoading(false))
    const refreshRanking = () => {
      getPlayRanking()
        .then((ranking) => setRanking(ranking.filter((item) => !hiddenGameIds.has(item.gameId))))
        .catch(() => {})
    }
    refreshRanking()
    window.addEventListener('storage', refreshRanking)
    return () => window.removeEventListener('storage', refreshRanking)
  }, [])

  const top5 = ranking.slice(0, 5)

  return (
    <main className="plaza-library">
      <header className="library-heading">
        <div>
          <p className="library-eyebrow">闲暇时刻 · 玩一局</p>
          <h1>发现下一份乐趣</h1>
          <p>挑一款喜欢的游戏，慢慢来，也可以挑战自己。</p>
        </div>
        <span className="library-count">{games.length || '—'} 款游戏</span>
      </header>
      {loading && (
        <div className="library-grid">
          {Array.from({ length: 6 }, (_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="library-error">
          {error}
        </p>
      )}
      {!loading && !error && (
        <>
          <div className="library-section-heading">
            <h2>全部游戏</h2>
            <span>即点即玩 · 进度保存在本机</span>
          </div>
          <div className="library-grid">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          <section className="library-popular" aria-labelledby="popular-title">
            <h2 id="popular-title">热门排行榜</h2>
            <p>本机累计 · 按盘数排序，同盘数按时长排序</p>
            {top5.length === 0 ? (
              <p>暂无排行记录，开始一局吧。</p>
            ) : (
              <ol>
                {top5.map((item, i) => (
                  <li key={item.gameId}>
                    <GameLaunchLink gameId={item.gameId}>
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <strong>{item.gameName}</strong>
                      <small>
                        {item.playCount} 盘 · {formatDuration(item.totalDuration)}
                      </small>
                    </GameLaunchLink>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  )
}
