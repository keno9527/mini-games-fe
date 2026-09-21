import { useGamePlay } from '@/hooks/useGamePlay'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createRecord } from '@/api'
import '../game-surfaces.css'

interface Props {
  userId?: string
  gameId: string
}

type DiffLevel = '简单' | '中等' | '复杂'

const EMOJIS_POOL = [
  '🐱',
  '🐶',
  '🦊',
  '🐻',
  '🐼',
  '🦁',
  '🐯',
  '🐸',
  '🐙',
  '🦋',
  '🌈',
  '⭐',
  '🍎',
  '🍓',
  '🎈',
  '🚀',
]

const CONFIGS: Record<DiffLevel, { pairs: number; emoji: string }> = {
  简单: { pairs: 6, emoji: '😊' },
  中等: { pairs: 8, emoji: '😐' },
  复杂: { pairs: 12, emoji: '😈' },
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
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
  useGamePlay(gameId, status === 'playing' ? 'playing' : 'idle')
  const [startTime, setStartTime] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
    },
    [],
  )
  const cfg = CONFIGS[difficulty]

  const submitRecord = useCallback(
    async (score: number, duration: number) => {
      if (!userId || submitted) return
      setSubmitted(true)
      try {
        await createRecord(userId, { gameId, score, duration, result: 'win' })
      } catch {}
    },
    [userId, gameId, submitted],
  )

  const reset = useCallback(
    (diff: DiffLevel = difficulty) => {
      if (pendingRef.current) clearTimeout(pendingRef.current)
      const c = CONFIGS[diff]
      setCards(makeCards(c.pairs))
      setFlipped(new Set())
      setMatched(new Set())
      setSelected([])
      setSteps(0)
      setLocked(false)
      setStatus('idle')
      setSubmitted(false)
    },
    [difficulty],
  )

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
      setSteps((s) => s + 1)
      setLocked(true)

      const [a, b] = newSelected
      const cardA = cards[a]
      const cardB = cards[b]

      if (cardA.pairId === cardB.pairId) {
        // Match!
        const newMatched = new Set(matched).add(a).add(b)
        pendingRef.current = setTimeout(() => {
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
        pendingRef.current = setTimeout(() => {
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

  return (
    <section className="game-surface memory-room">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">MEMORY ATELIER · 记忆收藏室</p>
          <h2>翻开一张小惊喜</h2>
        </div>
        <span className="memory-emblem" aria-hidden="true">
          ✦
        </span>
      </header>
      <div className="gs-toolbar">
        <div className="gs-segments" aria-label="配对难度">
          {(Object.keys(CONFIGS) as DiffLevel[]).map((d) => (
            <button
              key={d}
              aria-pressed={difficulty === d}
              onClick={() => {
                setDifficulty(d)
                reset(d)
              }}
            >
              {d} · {CONFIGS[d].pairs} 对
            </button>
          ))}
        </div>
        <button className="gs-secondary" onClick={() => reset()}>
          ↻ 重新洗牌
        </button>
      </div>
      <div className="gs-metrics">
        <div>
          <span>翻牌步数</span>
          <strong>{String(steps).padStart(2, '0')}</strong>
        </div>
        <div>
          <span>已收藏</span>
          <strong>
            {matched.size / 2}
            <small> / {cfg.pairs} 对</small>
          </strong>
        </div>
        <div>
          <span>本局状态</span>
          <b role="status">
            {status === 'won' ? '全部配对成功' : locked ? '留住这一刻' : '寻找相同图案'}
          </b>
        </div>
      </div>
      <div className="gs-progress" aria-label={`配对进度 ${matched.size / 2}/${cfg.pairs}`}>
        <span style={{ width: `${(matched.size / (cfg.pairs * 2)) * 100}%` }} />
      </div>
      <div className="memory-table">
        <div className={`memory-grid ${cfg.pairs >= 10 ? 'memory-grid-large' : ''}`}>
          {cards.map((card, idx) => {
            const isMatched = matched.has(idx)
            const isFlipped = flipped.has(idx) || isMatched
            return (
              <button
                key={card.id}
                className={`memory-card ${isFlipped ? 'is-flipped' : ''} ${isMatched ? 'is-matched' : ''}`}
                disabled={locked || isMatched || isFlipped}
                onClick={() => handleFlip(idx)}
                aria-label={`第 ${idx + 1} 张，${isFlipped ? card.emoji : '未翻开'}${isMatched ? '，已配对' : ''}`}
              >
                <span className="memory-card-inner" aria-hidden="true">
                  <span className="memory-back">
                    <span className="memory-card-corner">✧</span>
                    <span className="memory-rosette">✦</span>
                    <small>MEMORY</small>
                  </span>
                  <span className="memory-front">
                    <span>{card.emoji}</span>
                    <small>{isMatched ? '✓ 已收藏' : '记住我'}</small>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="memory-table-note">观察 · 记忆 · 相遇</p>
      </div>
      <div className="gs-footer" role="status">
        <p>
          {status === 'won'
            ? `漂亮！用 ${steps} 步找到了所有配对。`
            : status === 'idle'
              ? '点击任意卡牌开始，每次翻开两张，找到相同的图案。'
              : '不必着急，让每一次翻牌都有迹可循。'}
        </p>
        {status === 'won' && (
          <button className="gs-primary" onClick={() => reset()}>
            再玩一次 ↗
          </button>
        )}
      </div>
    </section>
  )
}
