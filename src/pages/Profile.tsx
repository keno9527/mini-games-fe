import { useEffect, useState } from 'react'
import { getUserStats, getRecords } from '@/api'
import { getCatalogGame } from '@/features/games/data'
import { GameIcon } from '@/components/GameCard'
import { useUserStore } from '@/store/userStore'
import UserSelector from '@/components/UserSelector'
import type { UserStats, GameRecord } from '@/types'

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}分 ${s}秒`
  return `${Math.floor(m / 60)}小时 ${m % 60}分`
}

function ResultBadge({ result }: { result: string }) {
  const labels: Record<string, string> = { win: '胜利', lose: '失败', complete: '完成' }
  return (
    <span className="profile-result" data-result={result}>
      {labels[result] ?? result}
    </span>
  )
}

function GameTitle({ gameId, name }: { gameId: string; name?: string }) {
  return (
    <div className="profile-game-title">
      <span className="profile-game-icon">
        <GameIcon gameId={gameId} size={26} />
      </span>
      <strong>{name || getCatalogGame(gameId)?.name || gameId}</strong>
    </div>
  )
}

export default function Profile() {
  const { currentUser } = useUserStore()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [records, setRecords] = useState<GameRecord[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser) {
      setStats(null)
      setRecords([])
      return
    }
    let active = true
    setLoadingStats(true)
    setError('')
    setStats(null)
    setRecords([])
    Promise.all([getUserStats(currentUser.id), getRecords(currentUser.id)])
      .then(([s, r]) => {
        if (!active) return
        setStats(s)
        setRecords(r.reverse())
      })
      .catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : '读取存档失败')
      })
      .finally(() => {
        if (active) setLoadingStats(false)
      })
    return () => {
      active = false
    }
  }, [currentUser])

  return (
    <main className="page-shell profile-page">
      <header className="page-heading">
        <h1 className="page-title">个人中心</h1>
        <p>管理玩家，查看游戏记录。</p>
      </header>
      <div className="profile-layout">
        <UserSelector />
        <div className="profile-content" aria-busy={loadingStats}>
          {error && (
            <p role="alert" className="player-error">
              {error}
            </p>
          )}
          {!currentUser && (
            <div className="profile-panel profile-empty">
              <h2>开启你的游戏档案</h2>
              <p>选择或创建玩家，查看你的游戏统计与历史记录。</p>
            </div>
          )}
          {currentUser && loadingStats && (
            <div className="profile-panel profile-empty" role="status">
              <p>正在读取游戏记录…</p>
            </div>
          )}
          {currentUser && !loadingStats && stats && (
            <>
              <dl className="profile-overview">
                {[
                  { label: '游戏局数', value: stats.totalGames },
                  { label: '累计得分', value: stats.totalScore },
                  { label: '游玩时长', value: formatTime(stats.totalTime) },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {stats.gameStats.length > 0 && (
                <section className="profile-panel" aria-labelledby="profile-games-title">
                  <h2 id="profile-games-title">游戏统计</h2>
                  <div className="profile-games">
                    {stats.gameStats.map((gs) => (
                      <article key={gs.gameId} className="profile-game-row">
                        <GameTitle gameId={gs.gameId} name={gs.gameName} />
                        <dl className="profile-game-metrics">
                          <div>
                            <dt>游玩次数</dt>
                            <dd>{gs.playCount}</dd>
                          </div>
                          <div>
                            <dt>最高得分</dt>
                            <dd>{gs.bestScore}</dd>
                          </div>
                          <div>
                            <dt>累计时长</dt>
                            <dd>{formatTime(gs.totalTime)}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              <section className="profile-panel" aria-labelledby="profile-history-title">
                <header className="profile-section-heading">
                  <h2 id="profile-history-title">最近记录</h2>
                  <span>
                    {records.length > 30
                      ? `最近 30 条 · 共 ${records.length} 条`
                      : `共 ${records.length} 条`}
                  </span>
                </header>
                {records.length === 0 ? (
                  <div className="profile-empty">
                    <h3>还没有游戏记录</h3>
                    <p>去玩一局，留下你的第一份成绩吧。</p>
                  </div>
                ) : (
                  <ul className="profile-history">
                    {records.slice(0, 30).map((r) => (
                      <li key={r.id} className="profile-history-row">
                        <GameTitle gameId={r.gameId} />
                        <ResultBadge result={r.result} />
                        <strong className="profile-record-score">{r.score}分</strong>
                        <span className="profile-record-duration">{formatTime(r.duration)}</span>
                        <time dateTime={r.playedAt}>
                          {new Date(r.playedAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
