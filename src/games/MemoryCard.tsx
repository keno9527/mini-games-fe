import { useState, useCallback, useEffect } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type DiffLevel = '简单' | '中等' | '复杂'

const EMOJIS_POOL = ['🐱', '🐶', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸',
                     '🐙', '🦋', '🌈', '⭐', '🍎', '🍓', '🎈', '🚀']

const CONFIGS: Record<DiffLevel, { pairs: number; emoji: string }> = {
  简单: { pairs: 6, emoji: '😊' },
  中等: { pairs: 8, emoji: '😐' },
  复杂: { pairs: 12, emoji: '😈' },
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function makeCards(pairs: number): { id: number; emoji: string; pairId: number }[] {
  const emojis = EMOJIS_POOL.slice(0, pairs)
  const doubled = [...emojis, ...emojis].map((emoji, i) => ({
    id: i,
    emoji,
    pairId: emojis.indexOf(emoji),
  }))
  return shuffle(doubled)
}

export default function MemoryCard({ userId, gameId }: Props) {
  const [difficulty, setDifficulty] = useState<DiffLevel>('简单')
  const [cards, setCards] = useState(() => makeCards(CONFIGS['简单'].pairs))
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number[]>([])
  const [steps, setSteps] = useState(0)
  const [locked, setLocked] = useState(false)
  const [status, setStatus] = useState<'idle' | 'playing' | 'won'>('idle')
  const [startTime, setStartTime] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const cfg = CONFIGS[difficulty]

  const submitRecord = useCallback(async (score: number, duration: number) => {
    if (!userId || submitted) return
    setSubmitted(true)
    try {
      await createRecord(userId, { gameId, score, duration, result: 'win' })
    } catch {}
  }, [userId, gameId, submitted])

  const reset = useCallback((diff: DiffLevel = difficulty) => {
    const c = CONFIGS[diff]
    setCards(makeCards(c.pairs))
    setFlipped(new Set())
    setMatched(new Set())
    setSelected([])
    setSteps(0)
    setLocked(false)
    setStatus('idle')
    setSubmitted(false)
  }, [difficulty])

  const handleFlip = (id: number) => {
    if (locked) return
    if (matched.has(id) || flipped.has(id)) return

    if (status === 'idle') {
      setStatus('playing')
      setStartTime(Date.now())
    }

    const newFlipped = new Set(flipped).add(id)
    const newSelected = [...selected, id]

    setFlipped(newFlipped)
    setSelected(newSelected)

    if (newSelected.length === 2) {
      setSteps(s => s + 1)
      setLocked(true)

      const [a, b] = newSelected
      const cardA = cards[a]
      const cardB = cards[b]

      if (cardA.pairId === cardB.pairId) {
        // Match!
        const newMatched = new Set(matched).add(a).add(b)
        setTimeout(() => {
          setMatched(newMatched)
          setFlipped(new Set())
          setSelected([])
          setLocked(false)

          if (newMatched.size === cfg.pairs * 2) {
            setStatus('won')
            const dur = Math.floor((Date.now() - startTime) / 1000)
            const score = Math.max(0, 1000 - (steps + 1) * 10)
            submitRecord(score, dur)
          }
        }, 500)
      } else {
        setTimeout(() => {
          setFlipped(new Set(matched)) // keep matched cards "flipped"
          setSelected([])
          setLocked(false)
        }, 900)
      }
    }
  }

  // Keep matched cards visible in flipped set
  useEffect(() => {
    if (matched.size > 0 && selected.length === 0) {
      setFlipped(new Set(matched))
    }
  }, [matched, selected])

  const cols = cfg.pairs >= 10 ? 6 : 4
  const totalCards = cfg.pairs * 2

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {(Object.keys(CONFIGS) as DiffLevel[]).map(d => (
          <button
            key={d}
            onClick={() => { setDifficulty(d); reset(d) }}
            className={`px-4 py-2 rounded-full text-sm font-black transition-all border-2 shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 ${
              difficulty === d
                ? 'bg-fun-pink text-white border-fun-pink'
                : 'border-fun-border text-fun-text hover:border-fun-pink/50 bg-fun-bg'
            }`}
          >
            {CONFIGS[d].emoji} {d}
          </button>
        ))}
        <div className="flex items-center gap-3 bg-fun-bg border-2 border-fun-border rounded-full px-4 py-2 text-sm font-bold text-fun-muted">
          <span>👣 {steps} 步</span>
          <span>✅ {matched.size / 2}/{cfg.pairs} 对</span>
        </div>
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-full text-sm font-bold border-2 border-fun-border text-fun-muted hover:border-fun-pink/50 bg-fun-bg transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5"
        >
          🔄 重置
        </button>
      </div>

      {/* Win banner */}
      {status === 'won' && (
        <div className="bg-gradient-to-r from-fun-pink to-fun-purple text-white font-black text-lg px-8 py-3 rounded-full shadow-btn animate-bounce">
          🎉 全部配对！用了 {steps} 步！
        </div>
      )}

      {/* Card grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.slice(0, totalCards).map((card, idx) => {
          const isFlipped = flipped.has(idx)
          const isMatched = matched.has(idx)

          return (
            <div
              key={card.id}
              onClick={() => handleFlip(idx)}
              className="relative cursor-pointer"
              style={{ width: 72, height: 72, perspective: '600px' }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.35s ease',
                  position: 'relative',
                }}
              >
                {/* Back face */}
                <div
                  className="absolute inset-0 rounded-2xl border-2 border-fun-border bg-gradient-to-br from-fun-pink/30 to-fun-purple/30 flex items-center justify-center shadow-card"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <span className="text-2xl">❓</span>
                </div>
                {/* Front face */}
                <div
                  className={`absolute inset-0 rounded-2xl border-2 flex items-center justify-center shadow-card text-4xl transition-all ${
                    isMatched
                      ? 'border-fun-green bg-green-50'
                      : 'border-fun-pink/50 bg-pink-50'
                  }`}
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  {card.emoji}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {status === 'won' && (
        <button
          onClick={() => reset()}
          className="px-8 py-3 rounded-full bg-fun-pink text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
        >
          再玩一次 🎴
        </button>
      )}

      {status === 'idle' && (
        <p className="text-sm text-fun-muted font-semibold">点击任意一张牌开始游戏！找到所有配对 🃏</p>
      )}
    </div>
  )
}
