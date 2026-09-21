import { useGamePlay } from '@/hooks/useGamePlay'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '@/api'
import '../game-surfaces.css'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'

const CFG: Record<
  Level,
  {
    holes: number
    duration: number
    spawnStart: number
    spawnMin: number
    hideMs: number
    gridCols: number
  }
> = {
  简单: { holes: 9, duration: 75, spawnStart: 1500, spawnMin: 850, hideMs: 1900, gridCols: 3 },
  中等: { holes: 9, duration: 60, spawnStart: 1200, spawnMin: 600, hideMs: 1400, gridCols: 3 },
  复杂: { holes: 12, duration: 45, spawnStart: 900, spawnMin: 420, hideMs: 1000, gridCols: 4 },
}

const MOLE_COLORS = ['#ac7959', '#8d7467', '#bd8f65', '#99755e']

function Mole({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="mole-character">
      <ellipse cx="23" cy="38" rx="12" ry="14" fill={color} />
      <ellipse cx="77" cy="38" rx="12" ry="14" fill={color} />
      <ellipse cx="23" cy="38" rx="6" ry="8" fill="#dca69c" />
      <ellipse cx="77" cy="38" rx="6" ry="8" fill="#dca69c" />
      <path d="M15 100V58C15 11 85 11 85 58V100" fill={color} />
      <ellipse cx="50" cy="76" rx="25" ry="27" fill="#ebd4b5" />
      <ellipse cx="35" cy="51" rx="4" ry="6" fill="#332b26" />
      <ellipse cx="65" cy="51" rx="4" ry="6" fill="#332b26" />
      <circle cx="36" cy="49" r="1.5" fill="white" />
      <circle cx="66" cy="49" r="1.5" fill="white" />
      <ellipse cx="50" cy="62" rx="8" ry="6" fill="#614137" />
      <path
        d="M43 72Q50 79 57 72"
        fill="none"
        stroke="#614137"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M47 74h6v7h-6z" fill="#fff8e7" />
      <ellipse cx="25" cy="65" rx="7" ry="4" fill="#dca69c" />
      <ellipse cx="75" cy="65" rx="7" ry="4" fill="#dca69c" />
      <path
        d="M35 33Q48 23 61 31"
        stroke="#ffffff30"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function WhackAMole({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const cfg = CFG[level]

  const [moles, setMoles] = useState<(string | null)[]>(() => Array(CFG['中等'].holes).fill(null))
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(CFG['中等'].duration)
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle')
  useGamePlay(gameId, status === 'playing' ? 'playing' : 'idle')
  const [whacked, setWhacked] = useState<number | null>(null)
  const [missed, setMissed] = useState<number | null>(null)

  const hideTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const feedbackTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
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
    hideTimersRef.current.forEach(clearTimeout)
    hideTimersRef.current.clear()
    feedbackTimersRef.current.forEach(clearTimeout)
    feedbackTimersRef.current = []
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
    setWhacked(null)
    setMissed(null)
    setScore(0)
    scoreRef.current = 0
    setTimeLeft(c.duration)
    setStatus('playing')
    statusRef.current = 'playing'
    submittedRef.current = false

    let remaining = c.duration
    timerRef.current = setInterval(() => {
      remaining--
      setTimeLeft(remaining)
      if (remaining > 0) return
      clearTimers()
      setStatus('over')
      statusRef.current = 'over'
      setMoles(Array(c.holes).fill(null))
      molesRef.current = Array(c.holes).fill(null)
      if (!submittedRef.current && userId) {
        submittedRef.current = true
        createRecord(userId, {
          gameId,
          score: scoreRef.current,
          duration: durationRef.current,
          result: 'complete',
        }).catch(() => {})
      }
    }, 1000)

    let spawnDelay = c.spawnStart
    const spawnMoles = () => {
      if (statusRef.current !== 'playing') return

      const next = [...molesRef.current]
      const empties = next.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0)
      const count = Math.min(empties.length, Math.floor(Math.random() * 2) + 1)
      for (let k = 0; k < count; k++) {
        const [idx] = empties.splice(Math.floor(Math.random() * empties.length), 1)
        next[idx] = MOLE_COLORS[Math.floor(Math.random() * MOLE_COLORS.length)]
        const timer = setTimeout(() => {
          const updated = [...molesRef.current]
          updated[idx] = null
          molesRef.current = updated
          setMoles(updated)
          hideTimersRef.current.delete(idx)
        }, c.hideMs)
        hideTimersRef.current.set(idx, timer)
      }
      molesRef.current = next
      setMoles(next)

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
    if (molesRef.current[idx] !== null) {
      const hideTimer = hideTimersRef.current.get(idx)
      if (hideTimer) clearTimeout(hideTimer)
      hideTimersRef.current.delete(idx)
      scoreRef.current += 10
      setScore(scoreRef.current)
      const next = [...molesRef.current]
      next[idx] = null
      molesRef.current = next
      setMoles(next)
      setWhacked(idx)
      feedbackTimersRef.current.push(
        setTimeout(() => setWhacked((current) => (current === idx ? null : current)), 400),
      )
    } else {
      setMissed(idx)
      feedbackTimersRef.current.push(
        setTimeout(() => setMissed((current) => (current === idx ? null : current)), 250),
      )
    }
  }

  const danger = timeLeft <= 10
  const picking = status === 'idle' || status === 'over'

  return (
    <section className="game-surface mole-room">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">GARDEN PATROL · 花园巡游</p>
          <h2>地鼠出没，请注意</h2>
        </div>
        <span className="mole-leaf" aria-hidden="true">
          ❧
        </span>
      </header>
      <div className="gs-toolbar">
        <div className="gs-segments" aria-label="游戏难度">
          {(Object.keys(CFG) as Level[]).map((lv) => (
            <button
              key={lv}
              disabled={!picking}
              aria-pressed={level === lv}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        <span className="gs-caption">{cfg.holes} 个洞口 · 每只 10 分</span>
      </div>
      <div className="gs-metrics">
        <div>
          <span>本局得分</span>
          <strong>{String(score).padStart(3, '0')}</strong>
        </div>
        <div>
          <span>成功击中</span>
          <strong>
            {score / 10}
            <small> 只</small>
          </strong>
        </div>
        <div className={danger && status === 'playing' ? 'gs-danger' : ''}>
          <span>剩余时间</span>
          <strong>
            {timeLeft}
            <small> 秒</small>
          </strong>
        </div>
      </div>
      <div className={`gs-progress ${danger ? 'gs-danger' : ''}`}>
        <span style={{ width: `${(timeLeft / cfg.duration) * 100}%` }} />
      </div>
      <div className="mole-garden">
        <div className="mole-garden-label">
          <span>✿ SUNNY GARDEN</span>
          <span>{status === 'playing' ? '巡游进行中' : '等你来挑战'}</span>
        </div>
        <div
          className="mole-grid"
          style={{ gridTemplateColumns: `repeat(${cfg.gridCols}, minmax(0,1fr))` }}
        >
          {moles.map((mole, idx) => (
            <button
              key={idx}
              disabled={status !== 'playing'}
              onClick={() => handleHit(idx)}
              className={`mole-hole ${mole && status === 'playing' ? 'is-up' : ''} ${whacked === idx ? 'is-hit' : ''} ${missed === idx ? 'is-missed' : ''}`}
              aria-label={`洞口 ${idx + 1}${mole && status === 'playing' ? '，地鼠出现' : '，空洞'}`}
            >
              <span className="mole-hole-shadow" />
              <span className="mole-clip">
                <Mole color={mole ?? MOLE_COLORS[0]} />
              </span>
              <span className="mole-hole-rim" />
              <span className="mole-hole-number" aria-hidden="true">
                {String(idx + 1).padStart(2, '0')}
              </span>
              {whacked === idx && <span className="mole-feedback">+10 ✦</span>}
              {missed === idx && <span className="mole-feedback miss">差一点</span>}
            </button>
          ))}
        </div>
        {status !== 'playing' && (
          <div className="mole-invitation">
            <span aria-hidden="true">✿</span>
            <div>
              <h3>{status === 'over' ? `时间到！收获 ${score} 分` : '小地鼠，藏在哪里？'}</h3>
              <p>
                {status === 'over'
                  ? `成功击中 ${score / 10} 只，再试一次手速吧。`
                  : '留意洞口，点击冒头的地鼠。'}
              </p>
            </div>
            <button className="gs-primary" onClick={startGame}>
              {status === 'over' ? '再来一局' : '开始巡游'} ↗
            </button>
          </div>
        )}
      </div>
      <p className="gs-footer" role="status">
        {status === 'playing'
          ? danger
            ? '最后十秒，抓紧机会！'
            : '地鼠会越冒越快，集中注意力。'
          : `每局 ${cfg.duration} 秒，点击洞口或用 Tab 和回车操作。`}
      </p>
    </section>
  )
}
