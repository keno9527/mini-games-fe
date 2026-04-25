import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'

const CFG: Record<
  Level,
  { holes: number; duration: number; spawnStart: number; spawnMin: number; hideMs: number; gridCols: number }
> = {
  简单: { holes: 9, duration: 75, spawnStart: 1500, spawnMin: 850, hideMs: 1900, gridCols: 3 },
  中等: { holes: 9, duration: 60, spawnStart: 1200, spawnMin: 600, hideMs: 1400, gridCols: 3 },
  复杂: { holes: 12, duration: 45, spawnStart: 900, spawnMin: 420, hideMs: 1000, gridCols: 4 },
}

const MOLE_EMOJIS = ['🐹', '🐭', '🐱', '🐸']

export default function WhackAMole({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const cfg = CFG[level]

  const [moles, setMoles] = useState<(string | null)[]>(() => Array(CFG['中等'].holes).fill(null))
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(CFG['中等'].duration)
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle')
  const [whacked, setWhacked] = useState<number | null>(null)
  const [missed, setMissed] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const molesRef = useRef<(string | null)[]>([])
  const scoreRef = useRef(0)
  const submittedRef = useRef(false)
  const statusRef = useRef<'idle' | 'playing' | 'over'>('idle')
  const durationRef = useRef(CFG['中等'].duration)

  molesRef.current = moles
  scoreRef.current = score
  statusRef.current = status

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (spawnRef.current) clearTimeout(spawnRef.current)
    timerRef.current = null
    spawnRef.current = null
  }

  useEffect(() => {
    setMoles(Array(cfg.holes).fill(null))
    molesRef.current = Array(cfg.holes).fill(null)
    setTimeLeft(cfg.duration)
  }, [level, cfg.holes, cfg.duration])

  const startGame = useCallback(() => {
    const c = CFG[level]
    durationRef.current = c.duration
    clearTimers()
    setMoles(Array(c.holes).fill(null))
    molesRef.current = Array(c.holes).fill(null)
    setScore(0)
    scoreRef.current = 0
    setTimeLeft(c.duration)
    setStatus('playing')
    statusRef.current = 'playing'
    setSubmitted(false)
    submittedRef.current = false

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearTimers()
          setStatus('over')
          statusRef.current = 'over'
          setTimeout(() => {
            if (!submittedRef.current && userId) {
              submittedRef.current = true
              setSubmitted(true)
              createRecord(userId, {
                gameId,
                score: scoreRef.current,
                duration: durationRef.current,
                result: 'complete',
              }).catch(() => {})
            }
          }, 100)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    let spawnDelay = c.spawnStart
    const spawnMoles = () => {
      if (statusRef.current !== 'playing') return

      setMoles(prev => {
        const next = [...prev]
        const empties = next.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0)
        const count = Math.min(empties.length, Math.floor(Math.random() * 2) + 1)
        for (let k = 0; k < count; k++) {
          const idx = empties[Math.floor(Math.random() * empties.length)]
          if (idx !== undefined) {
            next[idx] = MOLE_EMOJIS[Math.floor(Math.random() * MOLE_EMOJIS.length)]
            setTimeout(() => {
              setMoles(m => {
                const nm = [...m]
                if (idx < nm.length) nm[idx] = null
                return nm
              })
            }, c.hideMs)
          }
        }
        return next
      })

      spawnDelay = Math.max(c.spawnMin, spawnDelay - 10)
      if (statusRef.current === 'playing') {
        spawnRef.current = setTimeout(spawnMoles, spawnDelay)
      }
    }

    spawnRef.current = setTimeout(spawnMoles, spawnDelay)
  }, [userId, gameId, level])

  useEffect(() => () => clearTimers(), [])

  const handleHit = (idx: number) => {
    if (status !== 'playing') return
    if (moles[idx] !== null) {
      setScore(s => s + 10)
      setMoles(prev => {
        const next = [...prev]
        next[idx] = null
        return next
      })
      setWhacked(idx)
      setTimeout(() => setWhacked(null), 300)
    } else {
      setMissed(idx)
      setTimeout(() => setMissed(null), 200)
    }
  }

  const danger = timeLeft <= 10
  const picking = status === 'idle' || status === 'over'

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.keys(CFG) as Level[]).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!picking}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-green text-white border-fun-green'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-green/50'
            } ${!picking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl px-6 py-3 text-center shadow-card min-w-[110px]">
          <p className="text-3xl font-black text-fun-accent">🔨 {score}</p>
          <p className="text-xs text-fun-muted font-semibold">击中数</p>
        </div>
        {status === 'playing' && (
          <div className={`border-2 rounded-2xl px-6 py-3 text-center shadow-card min-w-[110px] ${danger ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-sky-50 border-sky-200'}`}>
            <p className={`text-3xl font-black ${danger ? 'text-red-500' : 'text-fun-sky'}`}>
              ⏰ {timeLeft}
            </p>
            <p className="text-xs text-fun-muted font-semibold">剩余秒数</p>
          </div>
        )}
      </div>

      <div
        className="grid gap-4 p-6 bg-gradient-to-b from-lime-100 to-green-100 rounded-3xl border-2 border-green-200 shadow-card"
        style={{ gridTemplateColumns: `repeat(${cfg.gridCols}, minmax(0, 1fr))` }}
      >
        {moles.map((mole, idx) => {
          const isWhacked = whacked === idx
          const isMissed = missed === idx
          const hasMole = mole !== null

          return (
            <div
              key={idx}
              className="relative flex items-end justify-center"
              style={{ width: 90, height: 90 }}
            >
              <div
                className="absolute bottom-0 w-20 h-10 rounded-full bg-gradient-to-b from-stone-400 to-stone-600 shadow-inner"
                style={{ boxShadow: 'inset 0 4px 8px rgba(0,0,0,0.4)' }}
              />

              <div
                onClick={() => handleHit(idx)}
                className="absolute bottom-3 cursor-pointer select-none z-10 transition-all duration-200"
                style={{
                  transform: hasMole
                    ? isWhacked ? 'translateY(-20px) scale(0.7)' : 'translateY(-28px) scale(1.1)'
                    : 'translateY(32px) scale(0.8)',
                  opacity: hasMole ? 1 : 0,
                  filter: isWhacked ? 'brightness(0.6)' : 'none',
                  fontSize: 48,
                  transition: hasMole
                    ? 'transform 0.2s cubic-bezier(.34,1.56,.64,1), opacity 0.15s'
                    : 'transform 0.2s ease-in, opacity 0.15s',
                }}
              >
                {mole ?? '🐹'}
              </div>

              {isMissed && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-red-400 font-black text-sm animate-ping">✗</span>
                </div>
              )}

              {isWhacked && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 text-fun-accent font-black text-base animate-bounce">
                  +10
                </div>
              )}
            </div>
          )
        })}
      </div>

      {status === 'idle' && (
        <div className="text-center space-y-3">
          <p className="text-fun-muted font-semibold text-sm">地鼠会随机出现，快点击消灭它们！</p>
          <button
            type="button"
            onClick={startGame}
            className="px-10 py-4 rounded-full bg-fun-green text-white font-black text-xl shadow-btn hover:shadow-btn-hover hover:-translate-y-1 transition-all"
          >
            开始打鼠！🔨
          </button>
        </div>
      )}

      {status === 'over' && (
        <div className="text-center bg-fun-card border-2 border-fun-border rounded-3xl p-8 shadow-card space-y-3">
          <div className="text-5xl">🎊</div>
          <p className="text-2xl font-black text-fun-text">时间到！</p>
          <p className="text-fun-muted font-semibold">
            共击中 <span className="text-fun-accent text-3xl font-black">{score / 10}</span> 只地鼠！
          </p>
          <p className="text-fun-muted font-semibold">
            得分：<span className="text-fun-accent text-2xl font-black">{score}</span> 分
          </p>
          <button
            type="button"
            onClick={startGame}
            className="px-10 py-4 rounded-full bg-fun-green text-white font-black text-lg shadow-btn hover:shadow-btn-hover hover:-translate-y-1 transition-all"
          >
            再打一局 🔨
          </button>
        </div>
      )}
    </div>
  )
}
