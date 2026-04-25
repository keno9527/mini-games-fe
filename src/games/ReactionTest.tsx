import { useState, useCallback, useRef, useEffect } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Phase = 'idle' | 'waiting' | 'ready' | 'between' | 'over'

const CFG: Record<
  Level,
  { rounds: number; waitMin: number; waitMax: number; earlyPenalty: number; readyTimeout: number }
> = {
  简单: { rounds: 5, waitMin: 900, waitMax: 2600, earlyPenalty: 12, readyTimeout: 3500 },
  中等: { rounds: 8, waitMin: 650, waitMax: 2200, earlyPenalty: 20, readyTimeout: 3000 },
  复杂: { rounds: 10, waitMin: 450, waitMax: 1800, earlyPenalty: 35, readyTimeout: 2500 },
}

function randWait(cfg: (typeof CFG)[Level]) {
  return cfg.waitMin + Math.floor(Math.random() * (cfg.waitMax - cfg.waitMin + 1))
}

function pointsForMs(ms: number) {
  return Math.max(0, Math.round(2200 - ms * 1.8))
}

export default function ReactionTest({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const cfg = CFG[level]

  const [phase, setPhase] = useState<Phase>('idle')
  const [roundIdx, setRoundIdx] = useState(0)
  const [totalScore, setTotalScore] = useState(0)
  const [lastMs, setLastMs] = useState<number | null>(null)
  const [hint, setHint] = useState('')

  const scoreRef = useRef(0)
  scoreRef.current = totalScore

  const readyAtRef = useRef(0)
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const betweenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionStartRef = useRef(0)
  const submittedRef = useRef(false)

  const clearTimers = () => {
    if (waitTimerRef.current) window.clearTimeout(waitTimerRef.current)
    if (readyTimerRef.current) window.clearTimeout(readyTimerRef.current)
    if (betweenTimerRef.current) window.clearTimeout(betweenTimerRef.current)
    waitTimerRef.current = null
    readyTimerRef.current = null
    betweenTimerRef.current = null
  }

  const submitSession = useCallback(
    async (score: number, durationSec: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      try {
        await createRecord(userId, { gameId, score, duration: durationSec, result: 'complete' })
      } catch {}
    },
    [userId, gameId]
  )

  const finishGame = useCallback(
    (finalScore: number) => {
      clearTimers()
      setPhase('over')
      const dur = Math.max(1, Math.floor((Date.now() - sessionStartRef.current) / 1000))
      void submitSession(finalScore, dur)
    },
    [submitSession]
  )

  const scheduleWait = useCallback(
    (c: (typeof CFG)[Level], r: number) => {
      clearTimers()
      setPhase('waiting')
      setHint('等背景变绿再点…')
      const delay = randWait(c)
      waitTimerRef.current = window.setTimeout(() => {
        waitTimerRef.current = null
        readyAtRef.current = Date.now()
        setPhase('ready')
        setHint('点！')
        readyTimerRef.current = window.setTimeout(() => {
          readyTimerRef.current = null
          setLastMs(null)
          setHint('超时未点，本轮 0 分')
          const next = r + 1
          if (next >= c.rounds) finishGame(scoreRef.current)
          else {
            setRoundIdx(next)
            setPhase('between')
            betweenTimerRef.current = window.setTimeout(() => {
              betweenTimerRef.current = null
              scheduleWait(c, next)
            }, 600)
          }
        }, c.readyTimeout)
      }, delay)
    },
    [finishGame]
  )

  const startGame = () => {
    const c = CFG[level]
    clearTimers()
    submittedRef.current = false
    sessionStartRef.current = Date.now()
    setTotalScore(0)
    scoreRef.current = 0
    setRoundIdx(0)
    setLastMs(null)
    setHint('')
    scheduleWait(c, 0)
  }

  useEffect(() => () => clearTimers(), [])

  const onTap = () => {
    if (phase === 'idle' || phase === 'over' || phase === 'between') return
    const c = CFG[level]

    if (phase === 'waiting') {
      clearTimers()
      setTotalScore(s => {
        const ns = Math.max(0, s - c.earlyPenalty)
        scoreRef.current = ns
        return ns
      })
      setHint(`点早了！-${c.earlyPenalty} 分，重来本轮`)
      scheduleWait(c, roundIdx)
      return
    }

    if (phase === 'ready') {
      clearTimers()
      const ms = Date.now() - readyAtRef.current
      setLastMs(ms)
      const pts = pointsForMs(ms)
      const next = roundIdx + 1
      const ns = scoreRef.current + pts
      scoreRef.current = ns
      setTotalScore(ns)
      if (next >= c.rounds) {
        window.setTimeout(() => finishGame(ns), 200)
      } else {
        setRoundIdx(next)
        setPhase('between')
        setHint(`+${pts} 分`)
        betweenTimerRef.current = window.setTimeout(() => {
          betweenTimerRef.current = null
          scheduleWait(c, next)
        }, 500)
      }
    }
  }

  const picking = phase === 'idle' || phase === 'over'

  useEffect(() => {
    if (picking) clearTimers()
  }, [level, picking])

  const resetIdle = () => {
    clearTimers()
    setPhase('idle')
    setRoundIdx(0)
    setTotalScore(0)
    scoreRef.current = 0
    setLastMs(null)
    setHint('')
    submittedRef.current = false
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.keys(CFG) as Level[]).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!picking}
            onClick={() => {
              setLevel(lv)
              resetIdle()
            }}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-green text-white border-fun-green'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-green/50'
            } ${!picking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}（{CFG[lv].rounds} 回合）
          </button>
        ))}
      </div>

      <div className="text-center text-sm font-bold text-fun-muted">
        总分：<span className="text-fun-accent text-2xl">{totalScore}</span>
        {phase !== 'idle' && phase !== 'over' && (
          <span className="ml-3">
            回合 {Math.min(roundIdx + 1, cfg.rounds)}/{cfg.rounds}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onTap}
        disabled={phase === 'idle' || phase === 'over' || phase === 'between'}
        className={`w-full max-w-sm min-h-[200px] rounded-3xl border-4 font-black text-2xl transition-all shadow-card active:scale-[0.98] ${
          phase === 'ready'
            ? 'bg-fun-green border-fun-green text-white animate-pulse'
            : phase === 'waiting'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-fun-border/40 border-fun-border text-fun-muted'
        } ${phase === 'between' || phase === 'idle' || phase === 'over' ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
      >
        {phase === 'idle' && '点击下方开始'}
        {phase === 'waiting' && '别点！'}
        {phase === 'ready' && '点！'}
        {phase === 'between' && '…'}
        {phase === 'over' && '结束'}
      </button>

      {lastMs !== null && phase !== 'ready' && (
        <p className="text-sm font-bold text-fun-text">上次反应：{lastMs} ms</p>
      )}
      {hint && <p className="text-sm font-semibold text-fun-muted max-w-sm text-center">{hint}</p>}

      {phase === 'idle' && (
        <button
          type="button"
          onClick={startGame}
          className="px-10 py-3 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
        >
          开始测试
        </button>
      )}

      {phase === 'over' && (
        <div className="text-center space-y-3 bg-fun-card border-2 border-fun-border rounded-3xl px-8 py-6 shadow-card">
          <p className="text-xl font-black text-fun-text">本轮结束</p>
          <p className="text-fun-muted font-semibold">
            总分 <span className="text-fun-accent text-3xl font-black">{totalScore}</span>
          </p>
          <button
            type="button"
            onClick={resetIdle}
            className="px-8 py-2 rounded-full border-2 border-fun-border font-bold text-fun-text hover:border-fun-accent/50 transition-all"
          >
            再测一次
          </button>
        </div>
      )}

      <p className="text-xs text-fun-muted font-semibold text-center max-w-md">
        屏幕变绿后尽快点击；绿之前点击会扣分并重新开始当前回合等待。
      </p>
    </div>
  )
}
