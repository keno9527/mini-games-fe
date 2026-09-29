import { useEffect, useState } from 'react'
import { getGames, getPlayRanking } from '@/api'
import GameCard, { GameIcon } from '@/components/GameCard'
import GameLaunchLink from '@/components/GameLaunchLink'
import { GameCardSkeleton } from '@/components/Skeleton'
import type { Game, PlayRankItem } from '@/types'

const hiddenGameIds = new Set([
  'animal-chess',
  'animal-chess-ai',
  'whack-a-mole',
  'tetris',
  'laser-mirror',
])

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
  const [rankingUnavailable, setRankingUnavailable] = useState(false)

  useEffect(() => {
    getGames()
      .then((games) => {
        const visibleGames = games.filter((game) => !hiddenGameIds.has(game.id))
        // Shuffle once per visit so ranking refreshes keep the unranked order stable.
        for (let i = visibleGames.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[visibleGames[i], visibleGames[j]] = [visibleGames[j], visibleGames[i]]
        }
        setGames(visibleGames)
      })
      .catch(() => setError('本地游戏配置读取失败，请刷新页面重试'))
      .finally(() => setLoading(false))
    const refreshRanking = () => {
      getPlayRanking()
        .then((ranking) => {
          setRanking(ranking.filter((item) => !hiddenGameIds.has(item.gameId)))
          setRankingUnavailable(false)
        })
        .catch(() => {
          setRanking([])
          setRankingUnavailable(true)
        })
    }
    refreshRanking()
    window.addEventListener('storage', refreshRanking)
    return () => window.removeEventListener('storage', refreshRanking)
  }, [])

  const top5 = ranking.slice(0, 5)
  const rankPositions = new Map(top5.map((item, index) => [item.gameId, index]))
  const sortedGames = [...games].sort(
    (a, b) => (rankPositions.get(a.id) ?? top5.length) - (rankPositions.get(b.id) ?? top5.length),
  )

  return (
    <main className="page-shell plaza-library">
      <div className="library-layout">
        <section className="library-games" aria-labelledby="games-title" aria-busy={loading}>
          <h1 id="games-title" className="page-title library-section-heading">
            全部游戏
            <span className="library-count">{loading ? '—' : games.length} 款游戏</span>
          </h1>
          {loading && (
            <>
              <span role="status" className="sr-only">
                正在加载游戏…
              </span>
              <div className="library-grid">
                {Array.from({ length: 8 }, (_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="library-error">
              {error}
            </p>
          )}
          {!loading && !error && (
            <div className="library-grid">
              {sortedGames.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>
        {!loading && !error && (
          <aside className="library-popular" aria-labelledby="popular-title">
            <h2 id="popular-title">热门排行榜</h2>
            <p>玩家存档累计 · 已结算对局</p>
            {rankingUnavailable ? (
              <p role="status">排行榜暂不可用，不影响进入游戏。</p>
            ) : top5.length === 0 ? (
              <p>暂无排行记录，开始一局吧。</p>
            ) : (
              <ol>
                {top5.map((item, i) => (
                  <li key={item.gameId}>
                    <GameLaunchLink gameId={item.gameId} className="library-rank-link">
                      <span className="library-rank-number">{String(i + 1).padStart(2, '0')}</span>
                      <GameIcon gameId={item.gameId} size={26} />
                      <div className="library-rank-details">
                        <strong>{item.gameName}</strong>
                        <small>
                          {item.playCount} 盘 · {formatDuration(item.totalDuration)}
                        </small>
                      </div>
                    </GameLaunchLink>
                  </li>
                ))}
              </ol>
            )}
            <p className="library-rank-note">按盘数排序，同盘数按时长排序</p>
          </aside>
        )}
      </div>
    </main>
  )
}
