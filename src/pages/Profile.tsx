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
    win:      { label: 'WIN',       cls: 'text-crt-green border-crt-green' },
    lose:     { label: 'LOSE',      cls: 'text-crt-pink border-crt-pink' },
    complete: { label: 'COMPLETE',  cls: 'text-crt-cyan border-crt-cyan' },
  }
  const { label, cls } = map[result] ?? { label: result, cls: 'text-crt-text-dim border-crt-border' }
  return (
    <span className={`font-pixel text-[8px] px-2 py-0.5 border-2 bg-transparent tracking-widest ${cls}`}>{label}</span>
  )
}

const statColors = [
  'text-crt-cyan',
  'text-crt-pink',
  'text-crt-yellow',
]
const statShadows = [
  '0 0 10px #00F0FF',
  '0 0 10px #FF2EC8',
  '0 0 10px #FFE500',
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
      <h1 className="font-pixel text-2xl md:text-3xl text-crt-cyan tracking-widest mb-8" style={{ textShadow: '0 0 12px #00F0FF' }}>
        &gt; PROFILE
      </h1>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-8 items-start">
        {/* Left: user selector */}
        <UserSelector />

        {/* Right: stats */}
        <div className="space-y-6">
          {!currentUser && (
            <div className="bg-crt-bg-card border-2 border-dashed border-crt-yellow/50 shadow-crt-card flex flex-col items-center justify-center py-24">
              <div className="font-pixel text-crt-yellow text-sm tracking-widest mb-4 animate-blink">
                PRESS START
              </div>
              <p className="font-mono-crt text-crt-text-dim text-lg tracking-wide">
                &gt; SELECT OR CREATE PLAYER
              </p>
            </div>
          )}

          {currentUser && loadingStats && (
            <div className="flex flex-col items-center py-16 gap-4">
              <div className="font-pixel text-crt-yellow text-sm tracking-widest animate-blink">LOADING...</div>
              <div className="font-mono-crt text-crt-cyan text-lg tracking-widest">▓▓▓▓▒▒▒▒</div>
            </div>
          )}

          {currentUser && !loadingStats && stats && (
            <>
              {/* Overview stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'TOTAL GAMES', value: stats.totalGames, suffix: '' },
                  { label: 'TOTAL SCORE', value: stats.totalScore, suffix: '' },
                  { label: 'PLAY TIME',   value: formatTime(stats.totalTime), suffix: '' },
                ].map(({ label, value, suffix }, i) => (
                  <div key={label} className="bg-crt-bg-card border-2 border-crt-border shadow-crt-card p-5 text-center">
                    <p className={`font-pixel text-2xl md:text-3xl mb-2 ${statColors[i]}`} style={{ textShadow: statShadows[i] }}>
                      {value}{suffix}
                    </p>
                    <p className="font-pixel text-[9px] text-crt-text-dim tracking-widest">{label}</p>
                  </div>
                ))}
              </div>

              {/* Per-game stats */}
              {stats.gameStats.length > 0 && (
                <div className="bg-crt-bg-card border-2 border-crt-cyan shadow-crt-card p-6">
                  <h3 className="font-pixel text-sm text-crt-cyan tracking-widest mb-4" style={{ textShadow: '0 0 8px #00F0FF' }}>
                    ▸ GAME STATS
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {stats.gameStats.map(gs => (
                      <div key={gs.gameId} className="bg-black/40 border border-crt-border p-4">
                        <p className="font-pixel text-[10px] text-crt-yellow mb-3 tracking-wider truncate">{gameNames[gs.gameId] ?? gs.gameName}</p>
                        <div className="space-y-1.5 font-mono-crt text-sm">
                          <div className="flex justify-between">
                            <span className="text-crt-text-dim tracking-wider">PLAYS</span>
                            <span className="text-crt-text">{gs.playCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-crt-text-dim tracking-wider">BEST</span>
                            <span className="text-crt-pink font-bold" style={{ textShadow: '0 0 6px #FF2EC8' }}>{gs.bestScore}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-crt-text-dim tracking-wider">TIME</span>
                            <span className="text-crt-text">{formatTime(gs.totalTime)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Record history */}
              <div className="bg-crt-bg-card border-2 border-crt-pink shadow-crt-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-pixel text-sm text-crt-pink tracking-widest" style={{ textShadow: '0 0 8px #FF2EC8' }}>
                    ▸ HISTORY LOG
                  </h3>
                  <span className="font-mono-crt text-xs text-crt-yellow bg-black px-2 py-0.5 border border-crt-yellow/50 tracking-widest">
                    LAST {records.length}
                  </span>
                </div>
                {records.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="font-pixel text-crt-text-dim text-xs tracking-widest mb-2">
                      NO RECORDS
                    </div>
                    <p className="font-mono-crt text-crt-text-dim text-base tracking-wide">&gt; go play a round!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {records.slice(0, 30).map(r => (
                      <div
                        key={r.id}
                        className="flex items-center gap-4 px-4 py-3 bg-black/40 border border-crt-border hover:border-crt-cyan/60 transition-colors font-mono-crt text-sm tracking-wide"
                      >
                        <span className="text-crt-text font-bold w-24 flex-shrink-0 truncate">
                          {gameNames[r.gameId] ?? r.gameId}
                        </span>
                        <ResultBadge result={r.result} />
                        <span className="text-crt-pink font-bold ml-auto tracking-wider" style={{ textShadow: '0 0 6px #FF2EC8' }}>
                          {r.score}PT
                        </span>
                        <span className="text-crt-text-dim">{formatTime(r.duration)}</span>
                        <span className="text-crt-text-dim text-xs">
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
