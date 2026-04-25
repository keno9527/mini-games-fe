import { useState, useCallback, useEffect, useRef } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

const SUITS = ['♠', '♥', '♦', '♣']
const SUIT_COLORS: Record<string, string> = {
  '♠': 'text-slate-800',
  '♣': 'text-slate-800',
  '♥': 'text-red-500',
  '♦': 'text-red-500',
}
const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

interface Card {
  rank: number
  suit: string
  value: number
}

function safeEval(expr: string): number | null {
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null
  try {
    const result = Function('"use strict"; return (' + expr + ')')()
    return typeof result === 'number' && isFinite(result) ? result : null
  } catch {
    return null
  }
}

function hasSolution(nums: number[]): boolean {
  if (nums.length === 1) return Math.abs(nums[0] - 24) < 1e-9
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue
      const rest = nums.filter((_, k) => k !== i && k !== j)
      const a = nums[i], b = nums[j]
      const candidates = [a + b, a - b, a * b]
      if (Math.abs(b) > 1e-9) candidates.push(a / b)
      for (const c of candidates) {
        if (hasSolution([c, ...rest])) return true
      }
    }
  }
  return false
}

const opColors: Record<string, string> = {
  '+': 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200',
  '-': 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200',
  '*': 'bg-purple-100 border-purple-300 text-purple-700 hover:bg-purple-200',
  '/': 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200',
  '(': 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200',
  ')': 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200',
}

type Level = '简单' | '中等' | '复杂'
const LEVEL_SECONDS: Record<Level, number> = {
  简单: 90,
  中等: 60,
  复杂: 40,
}

function randCardsForLevel(level: Level): Card[] {
  const gen = () => {
    let rank = Math.floor(Math.random() * 13) + 1
    if (level === '复杂' && Math.random() < 0.45) {
      rank = Math.floor(Math.random() * 7) + 7
    }
    const suit = SUITS[Math.floor(Math.random() * 4)]
    return { rank, suit, value: rank }
  }
  return Array.from({ length: 4 }, gen)
}

export default function TwentyFourPoints({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [cards, setCards] = useState<Card[]>(() => randCardsForLevel('中等'))
  const [expr, setExpr] = useState('')
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(LEVEL_SECONDS['中等'])
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle')
  const [submitted, setSubmitted] = useState(false)
  const timerHandle = useRef<ReturnType<typeof setInterval> | null>(null)
  const scoreRef = useRef(0)
  const submittedRef = useRef(false)
  const roundSecondsRef = useRef(LEVEL_SECONDS['中等'])
  scoreRef.current = score

  const submitRecord = useCallback(async (s: number, duration: number) => {
    if (!userId || submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    try {
      await createRecord(userId, { gameId, score: s, duration, result: 'complete' })
    } catch {}
  }, [userId, gameId])

  useEffect(() => {
    if (status === 'over') {
      submitRecord(scoreRef.current, roundSecondsRef.current)
    }
  }, [status, submitRecord])

  useEffect(() => {
    if (status === 'idle' || status === 'over') setTimeLeft(LEVEL_SECONDS[level])
  }, [level, status])

  const startGame = () => {
    if (timerHandle.current) clearInterval(timerHandle.current)
    const secs = LEVEL_SECONDS[level]
    roundSecondsRef.current = secs
    setScore(0)
    setStreak(0)
    setTimeLeft(secs)
    setCards(randCardsForLevel(level))
    setExpr('')
    setFeedback(null)
    setStatus('playing')
    setSubmitted(false)
    submittedRef.current = false

    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t)
          setStatus('over')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    timerHandle.current = t
  }

  const nextCard = (_bonusStreak: number) => {
    setCards(randCardsForLevel(level))
    setExpr('')
    setFeedback(null)
  }

  const handleSkip = () => {
    setStreak(0)
    nextCard(0)
    setFeedback({ msg: '跳过啦～', ok: false })
  }

  const handleSubmit = () => {
    if (status !== 'playing') return
    const userNums = expr.replace(/[^0-9.]/g, ' ').trim().split(/\s+/).map(Number).filter(n => !isNaN(n))
    const cardVals = [...cards.map(c => c.value)].sort((a, b) => a - b)
    const inputVals = [...userNums].sort((a, b) => a - b)

    if (userNums.length !== 4) {
      setFeedback({ msg: '请用全部4个数字哦！', ok: false })
      return
    }
    if (JSON.stringify(cardVals) !== JSON.stringify(inputVals)) {
      setFeedback({ msg: `请使用这四个数：${cards.map(c => c.value).join(', ')}`, ok: false })
      return
    }

    const result = safeEval(expr)
    if (result === null) {
      setFeedback({ msg: '表达式好像有问题～', ok: false })
      return
    }
    if (Math.abs(result - 24) < 1e-9) {
      const bonus = streak >= 2 ? 20 : streak >= 1 ? 15 : 10
      const newScore = score + bonus
      const newStreak = streak + 1
      setScore(newScore)
      setStreak(newStreak)
      setFeedback({ msg: `🎉 正确！+${bonus}分${newStreak >= 2 ? ` 🔥×${newStreak}` : ''}`, ok: true })
      setTimeout(() => nextCard(newStreak), 900)
    } else {
      setStreak(0)
      setFeedback({ msg: `结果是 ${result.toFixed(2)}，不是 24 哦`, ok: false })
    }
  }

  const insertNum = (v: number) => {
    setExpr(e => e + String(v))
  }

  const values = cards.map(c => c.value)
  const solvable = hasSolution(values)

  const picking = status === 'idle' || status === 'over'

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.keys(LEVEL_SECONDS) as Level[]).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!picking}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-accent text-white border-fun-accent'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-accent/50'
            } ${!picking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}（{LEVEL_SECONDS[lv]}s）
          </button>
        ))}
      </div>

      {/* Scoreboard */}
      <div className="flex items-center gap-4">
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl px-5 py-3 text-center shadow-card">
          <p className="text-3xl font-black text-fun-accent">⭐ {score}</p>
          <p className="text-xs text-fun-muted font-semibold">积分</p>
        </div>
        {status === 'playing' && (
          <>
            <div className={`border-2 rounded-2xl px-5 py-3 text-center shadow-card ${timeLeft <= 10 ? 'bg-red-50 border-red-300 animate-pulse' : 'bg-sky-50 border-sky-200'}`}>
              <p className={`text-3xl font-black ${timeLeft <= 10 ? 'text-red-500' : 'text-fun-sky'}`}>
                ⏰ {timeLeft}
              </p>
              <p className="text-xs text-fun-muted font-semibold">剩余秒数</p>
            </div>
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-5 py-3 text-center shadow-card">
              <p className="text-3xl font-black text-fun-green">🔥 {streak}</p>
              <p className="text-xs text-fun-muted font-semibold">连击</p>
            </div>
          </>
        )}
      </div>

      {/* Cards */}
      <div className="flex gap-4">
        {cards.map((card, i) => (
          <button
            key={i}
            onClick={() => status === 'playing' && insertNum(card.value)}
            className="w-20 h-28 rounded-2xl bg-white flex flex-col justify-between p-2 shadow-card hover:shadow-card-hover hover:-translate-y-1 active:scale-95 transition-all cursor-pointer border-2 border-fun-border hover:border-fun-accent/50"
            title={`点击插入 ${card.value}`}
          >
            <span className={`text-lg font-black ${SUIT_COLORS[card.suit]}`}>
              {RANK_LABELS[card.rank]}
            </span>
            <span className={`text-2xl text-center w-full ${SUIT_COLORS[card.suit]}`}>
              {card.suit}
            </span>
            <span className={`text-lg font-black self-end rotate-180 ${SUIT_COLORS[card.suit]}`}>
              {RANK_LABELS[card.rank]}
            </span>
          </button>
        ))}
      </div>

      {!solvable && status === 'playing' && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl px-4 py-2 text-sm text-yellow-700 font-bold">
          😅 这组没有解，可以跳过哦
        </div>
      )}

      {/* Input */}
      {status === 'playing' && (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={expr}
              onChange={e => setExpr(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="例：(1+3)×(8-2)"
              className="flex-1 bg-fun-bg border-2 border-fun-border rounded-2xl px-4 py-2.5 text-sm text-fun-text placeholder-fun-muted focus:outline-none focus:border-fun-accent transition-colors font-mono font-semibold"
            />
            <button
              onClick={() => setExpr(e => e.slice(0, -1))}
              className="px-3 py-2 rounded-2xl border-2 border-fun-border text-fun-muted hover:text-fun-text hover:border-fun-accent/50 bg-fun-bg transition-all text-sm font-bold shadow-btn hover:shadow-btn-hover"
            >
              ⌫
            </button>
          </div>

          {/* Operator shortcuts */}
          <div className="flex gap-2">
            {['+', '-', '*', '/', '(', ')'].map(op => (
              <button
                key={op}
                onClick={() => setExpr(e => e + op)}
                className={`w-11 h-11 rounded-2xl border-2 font-black transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 active:scale-95 text-sm ${opColors[op] ?? ''}`}
              >
                {op}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              className="px-7 py-2.5 rounded-full bg-fun-accent text-white font-black text-base shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
            >
              ✅ 提交
            </button>
            <button
              onClick={handleSkip}
              className="px-7 py-2.5 rounded-full border-2 border-fun-border text-fun-text font-bold bg-fun-bg hover:border-fun-accent/50 transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 text-sm"
            >
              跳过
            </button>
          </div>

          {feedback && (
            <div className={`px-5 py-2.5 rounded-2xl border-2 font-bold text-sm ${
              feedback.ok
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {feedback.msg}
            </div>
          )}
        </div>
      )}

      {status === 'idle' && (
        <div className="text-center">
          <p className="text-fun-muted font-semibold text-sm mb-5">用4个数字加减乘除（可加括号）凑出 <span className="text-fun-accent font-black text-lg">24</span></p>
          <button
            onClick={startGame}
            className="px-10 py-4 rounded-full bg-fun-accent text-white font-black text-xl shadow-btn hover:shadow-btn-hover hover:-translate-y-1 transition-all"
          >
            🎮 开始游戏！
          </button>
        </div>
      )}

      {status === 'over' && (
        <div className="text-center space-y-4 bg-fun-card border-2 border-fun-border rounded-3xl p-8 shadow-card">
          <div className="text-5xl">🎊</div>
          <p className="text-2xl font-black text-fun-text">时间到啦！</p>
          <p className="text-fun-muted font-semibold">最终得分：<span className="text-fun-accent text-3xl font-black">{score}</span> 分</p>
          <button
            onClick={startGame}
            className="px-10 py-4 rounded-full bg-fun-accent text-white font-black text-lg shadow-btn hover:shadow-btn-hover hover:-translate-y-1 transition-all"
          >
            再玩一次 🎮
          </button>
        </div>
      )}

      {status !== 'playing' && (
        <div className="text-xs text-fun-muted font-semibold text-center">
          👆 点击牌面数字快速插入 · 支持 +、-、*、/ 和括号
        </div>
      )}
    </div>
  )
}
