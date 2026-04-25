import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Pos = { x: number; y: number }
type Level = '简单' | '中等' | '复杂'

const CONFIG: Record<
  Level,
  { cols: number; rows: number; cell: number; baseSpeed: number; minSpeed: number; speedStep: number }
> = {
  简单: { cols: 20, rows: 14, cell: 24, baseSpeed: 220, minSpeed: 110, speedStep: 12 },
  中等: { cols: 30, rows: 20, cell: 20, baseSpeed: 180, minSpeed: 80, speedStep: 10 },
  复杂: { cols: 36, rows: 24, cell: 16, baseSpeed: 145, minSpeed: 55, speedStep: 8 },
}

function initSnake(cols: number, rows: number): Pos[] {
  const midX = Math.floor(cols / 2)
  const midY = Math.floor(rows / 2)
  return [
    { x: midX, y: midY },
    { x: midX - 1, y: midY },
    { x: midX - 2, y: midY },
  ]
}

function randFood(snake: Pos[], cols: number, rows: number): Pos {
  let pos: Pos
  do {
    pos = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) }
  } while (snake.some(s => s.x === pos.x && s.y === pos.y))
  return pos
}

export default function Snake({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const cfg = CONFIG[level]

  const [snake, setSnake] = useState<Pos[]>(() => initSnake(cfg.cols, cfg.rows))
  const [food, setFood] = useState<Pos>(() => randFood(initSnake(cfg.cols, cfg.rows), cfg.cols, cfg.rows))
  const [dir, setDir] = useState<Dir>('RIGHT')
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'over'>('idle')
  const [highScore, setHighScore] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const dirRef = useRef<Dir>('RIGHT')
  const snakeRef = useRef(snake)
  const foodRef = useRef(food)
  const scoreRef = useRef(0)
  const startTimeRef = useRef(0)
  const statusRef = useRef<'idle' | 'playing' | 'paused' | 'over'>('idle')
  const gridRef = useRef({ cols: cfg.cols, rows: cfg.rows })

  snakeRef.current = snake
  foodRef.current = food
  scoreRef.current = score
  statusRef.current = status
  gridRef.current = { cols: cfg.cols, rows: cfg.rows }

  const submitRecord = useCallback(async (s: number, duration: number) => {
    if (!userId || submitted) return
    setSubmitted(true)
    try {
      await createRecord(userId, { gameId, score: s, duration, result: 'complete' })
    } catch {}
  }, [userId, gameId, submitted])

  const restartLayout = useCallback(() => {
    const { cols, rows } = CONFIG[level]
    const init = initSnake(cols, rows)
    setSnake(init)
    setFood(randFood(init, cols, rows))
    setDir('RIGHT')
    dirRef.current = 'RIGHT'
    setScore(0)
    setStatus('idle')
    setSubmitted(false)
  }, [level])

  useEffect(() => {
    restartLayout()
  }, [level, restartLayout])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
        w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
      }
      const d = map[e.key]
      if (!d) return
      e.preventDefault()
      const opp: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
      if (d !== opp[dirRef.current]) {
        dirRef.current = d
        setDir(d)
      }
      if (statusRef.current === 'idle') {
        setStatus('playing')
        statusRef.current = 'playing'
        startTimeRef.current = Date.now()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (status !== 'playing') return

    const { baseSpeed, minSpeed, speedStep } = CONFIG[level]
    const speed = Math.max(minSpeed, baseSpeed - Math.floor(score / 5) * speedStep)
    const timer = setInterval(() => {
      if (statusRef.current !== 'playing') return

      const { cols: COLS, rows: ROWS } = gridRef.current
      const s = snakeRef.current
      const head = s[0]
      const delta: Record<Dir, Pos> = {
        UP: { x: 0, y: -1 },
        DOWN: { x: 0, y: 1 },
        LEFT: { x: -1, y: 0 },
        RIGHT: { x: 1, y: 0 },
      }
      const d = delta[dirRef.current]
      const next: Pos = { x: head.x + d.x, y: head.y + d.y }

      if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
        setStatus('over')
        const dur = Math.floor((Date.now() - startTimeRef.current) / 1000)
        submitRecord(scoreRef.current, dur)
        return
      }
      if (s.some(seg => seg.x === next.x && seg.y === next.y)) {
        setStatus('over')
        const dur = Math.floor((Date.now() - startTimeRef.current) / 1000)
        submitRecord(scoreRef.current, dur)
        return
      }

      const f = foodRef.current
      const ate = next.x === f.x && next.y === f.y
      const newSnake = ate ? [next, ...s] : [next, ...s.slice(0, -1)]
      setSnake(newSnake)

      if (ate) {
        const ns = scoreRef.current + 10
        setScore(ns)
        setHighScore(h => Math.max(h, ns))
        setFood(randFood(newSnake, COLS, ROWS))
      }
    }, speed)

    return () => clearInterval(timer)
  }, [status, score, submitRecord, level])

  const togglePause = () => {
    if (status === 'playing') setStatus('paused')
    else if (status === 'paused') setStatus('playing')
  }

  const startGame = () => {
    setStatus('playing')
    startTimeRef.current = Date.now()
  }

  const pickingIdle = status === 'idle' || status === 'over'

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap items-center gap-2 justify-center">
        {(Object.keys(CONFIG) as Level[]).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!pickingIdle}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 shadow-btn transition-all ${
              level === lv
                ? 'bg-fun-green text-white border-fun-green'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-green/50'
            } ${!pickingIdle ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-center">
        {[
          { label: '当前分数', value: score, color: 'text-fun-accent', bg: 'bg-orange-50 border-orange-200', emoji: '⭐' },
          { label: '最高分', value: highScore, color: 'text-fun-purple', bg: 'bg-purple-50 border-purple-200', emoji: '🏆' },
          { label: '长度', value: snake.length, color: 'text-fun-green', bg: 'bg-green-50 border-green-200', emoji: '🐍' },
        ].map(({ label, value, color, bg, emoji }) => (
          <div key={label} className={`${bg} border-2 rounded-2xl px-4 py-3 text-center shadow-card min-w-[90px]`}>
            <p className={`text-2xl font-black ${color}`}>{emoji} {value}</p>
            <p className="text-xs text-fun-muted font-semibold mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div
        className="relative border-4 border-fun-border rounded-3xl overflow-hidden shadow-card"
        style={{ width: cfg.cols * cfg.cell, height: cfg.rows * cfg.cell, background: '#e8f4f8' }}
      >
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: 0.08 }}
          width={cfg.cols * cfg.cell}
          height={cfg.rows * cfg.cell}
        >
          {Array.from({ length: cfg.cols + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i * cfg.cell} y1={0} x2={i * cfg.cell} y2={cfg.rows * cfg.cell} stroke="#38bdf8" strokeWidth="0.5" />
          ))}
          {Array.from({ length: cfg.rows + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i * cfg.cell} x2={cfg.cols * cfg.cell} y2={i * cfg.cell} stroke="#38bdf8" strokeWidth="0.5" />
          ))}
        </svg>

        {snake.map((seg, i) => (
          <div
            key={`${seg.x}-${seg.y}-${i}`}
            className="absolute rounded-md transition-all"
            style={{
              left: seg.x * cfg.cell + 1,
              top: seg.y * cfg.cell + 1,
              width: cfg.cell - 2,
              height: cfg.cell - 2,
              background: i === 0
                ? '#22c55e'
                : `hsl(${140 - i}, 75%, ${52 - i * 0.4}%)`,
              boxShadow: i === 0 ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
            }}
          />
        ))}

        <div
          className="absolute rounded-full"
          style={{
            left: food.x * cfg.cell + 2,
            top: food.y * cfg.cell + 2,
            width: cfg.cell - 4,
            height: cfg.cell - 4,
            background: '#f472b6',
            boxShadow: '0 0 8px rgba(244,114,182,0.8)',
          }}
        />

        {status === 'idle' && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-2xl">
            <p className="text-fun-text text-xl font-black">🐍 准备好了吗？</p>
            <button
              type="button"
              onClick={startGame}
              className="px-8 py-3 rounded-full bg-fun-green text-white font-black text-lg shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
            >
              开始游戏！
            </button>
            <p className="text-fun-muted text-xs font-semibold">使用 WASD 或方向键控制</p>
          </div>
        )}
        {status === 'paused' && (
          <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center rounded-2xl">
            <p className="text-fun-text text-2xl font-black">⏸ 已暂停</p>
          </div>
        )}
        {status === 'over' && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-2xl">
            <p className="text-3xl">😢</p>
            <p className="text-red-500 text-2xl font-black">游戏结束！</p>
            <p className="text-fun-text text-lg font-semibold">得分：<span className="text-fun-accent font-black text-2xl">{score}</span></p>
            <button
              type="button"
              onClick={restartLayout}
              className="px-8 py-3 rounded-full bg-fun-accent text-white font-black text-lg shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
            >
              再来一局 🎮
            </button>
          </div>
        )}
      </div>

      {(status === 'playing' || status === 'paused') && (
        <button
          type="button"
          onClick={togglePause}
          className="px-6 py-2 rounded-full border-2 border-fun-border text-fun-text font-bold hover:border-fun-accent/50 bg-fun-bg transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 text-sm"
        >
          {status === 'playing' ? '⏸ 暂停' : '▶ 继续'}
        </button>
      )}

      <div className="grid grid-cols-3 gap-2 mt-1">
        {[
          [null, '↑', null],
          ['←', '·', '→'],
          [null, '↓', null],
        ].map((row, ri) =>
          row.map((key, ci) =>
            key && key !== '·' ? (
              <button
                type="button"
                key={`${ri}-${ci}`}
                onMouseDown={() => {
                  const map2: Record<string, Dir> = { '↑': 'UP', '↓': 'DOWN', '←': 'LEFT', '→': 'RIGHT' }
                  const d = map2[key]
                  if (d) {
                    const opp: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
                    if (d !== opp[dirRef.current]) {
                      dirRef.current = d
                      setDir(d)
                    }
                  }
                  if (statusRef.current === 'idle') {
                    setStatus('playing')
                    statusRef.current = 'playing'
                    startTimeRef.current = Date.now()
                  }
                }}
                className={`w-12 h-12 rounded-2xl bg-fun-card border-2 border-fun-border text-fun-text font-black hover:bg-fun-accent/10 hover:border-fun-accent/40 active:scale-95 active:shadow-none shadow-btn transition-all text-sm ${
                  dir === ({ '↑': 'UP', '↓': 'DOWN', '←': 'LEFT', '→': 'RIGHT' } as Record<string, Dir>)[key]
                    ? 'bg-fun-accent/15 border-fun-accent'
                    : ''
                }`}
              >
                {key}
              </button>
            ) : (
              <div key={`${ri}-${ci}`} />
            )
          )
        )}
      </div>
    </div>
  )
}
