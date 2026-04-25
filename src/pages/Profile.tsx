import { useEffect, useState } from 'react'
import { getUserStats, getRecords } from '../api'
import { useUserStore } from '../store/userStore'
import UserSelector from '../components/UserSelector'
import type { UserStats, GameRecord } from '../types'

const gameNames: Record<string, string> = {
  minesweeper: '💣 扫雷',
  snake: '🐍 贪吃蛇',
  '24points': '🃏 24点',
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return `${m}m ${s}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function ResultBadge({ result }: { result: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    win:      { label: '🏆 胜利', cls: 'text-green-700 bg-green-100 border-green-200' },
    lose:     { label: '💥 失败', cls: 'text-red-600 bg-red-100 border-red-200' },
    complete: { label: '✅ 完成', cls: 'text-fun-accent bg-orange-100 border-orange-200' },
  }
  const { label, cls } = map[result] ?? { label: result, cls: 'text-fun-muted bg-fun-border border-fun-border' }
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border-2 ${cls}`}>{label}</span>
  )
}

const statColors = [
  'text-fun-accent',
  'text-fun-purple',
  'text-fun-green',
]

export default function Profile() {
  const { currentUser } = useUserStore()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [records, setRecords] = useState<GameRecord[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      setStats(null)
      setRecords([])
      return
    }
    setLoadingStats(true)
    Promise.all([
      getUserStats(currentUser.id),
      getRecords(currentUser.id),
    ])
      .then(([s, r]) => {
        setStats(s)
        setRecords(r.reverse())
      })
      .finally(() => setLoadingStats(false))
  }, [currentUser])

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="text-4xl font-black text-fun-text mb-8 flex items-center gap-3">
        👤 个人中心
      </h1>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-8 items-start">
        {/* Left: user selector */}
        <UserSelector />

        {/* Right: stats */}
        <div className="space-y-6">
          {!currentUser && (
            <div className="bg-fun-card border-2 border-fun-border rounded-3xl flex flex-col items-center justify-center py-24 shadow-card">
              <span className="text-6xl mb-4">🎮</span>
              <p className="text-fun-muted font-bold text-lg">请在左边选择或创建用户哦！</p>
            </div>
          )}

          {currentUser && loadingStats && (
            <div className="flex flex-col items-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-fun-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-fun-muted font-semibold">加载中...</p>
            </div>
          )}

          {currentUser && !loadingStats && stats && (
            <>
              {/* Overview stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '总场次', value: stats.totalGames, suffix: '局', emoji: '🎲' },
                  { label: '总积分', value: stats.totalScore, suffix: '分', emoji: '⭐' },
                  { label: '游戏时长', value: formatTime(stats.totalTime), suffix: '', emoji: '⏰' },
                ].map(({ label, value, suffix, emoji }, i) => (
                  <div key={label} className="bg-fun-card border-2 border-fun-border rounded-3xl p-5 text-center shadow-card">
                    <div className="text-2xl mb-1">{emoji}</div>
                    <p className={`text-3xl font-black mb-1 ${statColors[i]}`}>
                      {value}{suffix && <span className="text-base font-bold text-fun-muted ml-1">{suffix}</span>}
                    </p>
                    <p className="text-sm text-fun-muted font-semibold">{label}</p>
                  </div>
                ))}
              </div>

              {/* Per-game stats */}
              {stats.gameStats.length > 0 && (
                <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-6 shadow-card">
                  <h3 className="text-lg font-black text-fun-text mb-4 flex items-center gap-2">
                    📊 游戏统计
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {stats.gameStats.map(gs => (
                      <div key={gs.gameId} className="bg-fun-bg rounded-2xl p-4 border-2 border-fun-border">
                        <p className="text-sm font-black text-fun-text mb-2">{gameNames[gs.gameId] ?? gs.gameName}</p>
                        <div className="space-y-1 text-xs font-semibold text-fun-muted">
                          <div className="flex justify-between">
                            <span>游玩次数</span><span className="text-fun-text font-bold">{gs.playCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>最高分</span><span className="text-fun-accent font-black">{gs.bestScore}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>总时长</span><span className="text-fun-text font-bold">{formatTime(gs.totalTime)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Record history */}
              <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-6 shadow-card">
                <h3 className="text-lg font-black text-fun-text mb-4 flex items-center gap-2">
                  📜 游戏记录
                  <span className="text-sm font-bold text-fun-muted bg-fun-border px-2 py-0.5 rounded-full">
                    最近 {records.length} 条
                  </span>
                </h3>
                {records.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🎮</div>
                    <p className="text-fun-muted font-bold">暂无记录，快去玩一局吧！</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {records.slice(0, 30).map(r => (
                      <div
                        key={r.id}
                        className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-fun-bg border-2 border-fun-border hover:border-fun-accent/30 transition-colors text-sm"
                      >
                        <span className="text-fun-text font-black w-20 flex-shrink-0">
                          {gameNames[r.gameId] ?? r.gameId}
                        </span>
                        <ResultBadge result={r.result} />
                        <span className="text-fun-accent font-black ml-auto">{r.score} 分</span>
                        <span className="text-fun-muted font-semibold">{formatTime(r.duration)}</span>
                        <span className="text-fun-muted text-xs font-semibold">
                          {new Date(r.playedAt).toLocaleString('zh-CN', {
                            month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
