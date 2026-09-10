import { useState, useEffect, useRef, useCallback, useId } from 'react'
import './snake.css'
import { useGameRecord } from '@/hooks/useGameRecord'

interface Props {
  userId?: string
  gameId: string
}

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Pos = { x: number; y: number }
type Level = '简单' | '中等' | '复杂'

const CONFIG: Record<
  Level,
  {
    cols: number
    rows: number
    cell: number
    baseSpeed: number
    minSpeed: number
    speedStep: number
  }
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
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y))
  return pos
}

export default function Snake({ userId, gameId }: Props) {
  const artId = useId().replace(/:/g, '')
  const [level, setLevel] = useState<Level>('中等')
  const cfg = CONFIG[level]

  const [snake, setSnake] = useState<Pos[]>(() => initSnake(cfg.cols, cfg.rows))
  const [food, setFood] = useState<Pos>(() =>
    randFood(initSnake(cfg.cols, cfg.rows), cfg.cols, cfg.rows),
  )
  const [dir, setDir] = useState<Dir>('RIGHT')
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<'idle' | 'playing' | 'paused' | 'over'>('idle')
  const [highScore, setHighScore] = useState(0)

  const dirRef = useRef<Dir>('RIGHT')
  const snakeRef = useRef(snake)
  const foodRef = useRef(food)
  const scoreRef = useRef(0)
  const statusRef = useRef<'idle' | 'playing' | 'paused' | 'over'>('idle')
  const gridRef = useRef({ cols: cfg.cols, rows: cfg.rows })

  snakeRef.current = snake
  foodRef.current = food
  scoreRef.current = score
  statusRef.current = status
  gridRef.current = { cols: cfg.cols, rows: cfg.rows }

  const {
    start: startRecord,
    submit: submitRecord,
    reset: resetRecord,
  } = useGameRecord({ userId, gameId })

  const restartLayout = useCallback(() => {
    const { cols, rows } = CONFIG[level]
    const init = initSnake(cols, rows)
    setSnake(init)
    setFood(randFood(init, cols, rows))
    setDir('RIGHT')
    dirRef.current = 'RIGHT'
    setScore(0)
    setStatus('idle')
    resetRecord()
  }, [level, resetRecord])

  useEffect(() => {
    restartLayout()
  }, [level, restartLayout])

  const changeDirection = useCallback(
    (next: Dir) => {
      if (statusRef.current === 'paused' || statusRef.current === 'over') return
      const opposite: Record<Dir, Dir> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' }
      const body = snakeRef.current
      // Compare with the actual neck so rapid inputs cannot reverse into the snake.
      const movement: Dir =
        body[0].x > body[1].x
          ? 'RIGHT'
          : body[0].x < body[1].x
            ? 'LEFT'
            : body[0].y > body[1].y
              ? 'DOWN'
              : 'UP'
      if (next === opposite[movement]) return
      dirRef.current = next
      setDir(next)
      if (statusRef.current === 'idle') {
        setStatus('playing')
        statusRef.current = 'playing'
        startRecord()
      }
    },
    [startRecord],
  )

  const togglePause = useCallback(() => {
    const current = statusRef.current
    if (current !== 'playing' && current !== 'paused') return
    const next = current === 'playing' ? 'paused' : 'playing'
    statusRef.current = next
    setStatus(next)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        // Keep native keyboard activation on buttons.
        if (e.target instanceof HTMLElement && e.target.closest('button, a')) return
        if (statusRef.current === 'playing' || statusRef.current === 'paused') {
          e.preventDefault()
          if (!e.repeat) togglePause()
        }
        return
      }
      const map: Record<string, Dir> = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP',
        s: 'DOWN',
        a: 'LEFT',
        d: 'RIGHT',
      }
      const next = map[e.key] ?? map[e.key.toLowerCase()]
      if (!next) return
      e.preventDefault()
      changeDirection(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeDirection, togglePause])

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
        void submitRecord({ score: scoreRef.current, result: 'complete' })
        return
      }
      if (s.some((seg) => seg.x === next.x && seg.y === next.y)) {
        setStatus('over')
        void submitRecord({ score: scoreRef.current, result: 'complete' })
        return
      }

      const f = foodRef.current
      const ate = next.x === f.x && next.y === f.y
      const newSnake = ate ? [next, ...s] : [next, ...s.slice(0, -1)]
      setSnake(newSnake)

      if (ate) {
        const ns = scoreRef.current + 10
        setScore(ns)
        setHighScore((h) => Math.max(h, ns))
        setFood(randFood(newSnake, COLS, ROWS))
      }
    }, speed)

    return () => clearInterval(timer)
  }, [status, score, submitRecord, level])

  const startGame = () => {
    if (statusRef.current === 'over') restartLayout()
    setStatus('playing')
    statusRef.current = 'playing'
    startRecord()
  }

  const pickingIdle = status === 'idle' || status === 'over'
  const speed = Math.max(cfg.minSpeed, cfg.baseSpeed - Math.floor(score / 5) * cfg.speedStep)
  const speedProgress = (cfg.baseSpeed - speed) / (cfg.baseSpeed - cfg.minSpeed)
  const stateLabel = { idle: '准备就绪', playing: '游走中', paused: '已暂停', over: '本局结束' }[
    status
  ]
  const width = cfg.cols * cfg.cell
  const height = cfg.rows * cfg.cell
  const center = (pos: Pos) => `${(pos.x + 0.5) * cfg.cell},${(pos.y + 0.5) * cfg.cell}`
  const head = snake[0]
  const neck = snake[1]
  const angle = head.x > neck.x ? 0 : head.x < neck.x ? 180 : head.y > neck.y ? 90 : -90
  const directions: { direction: Dir; label: string; symbol: string }[] = [
    { direction: 'UP', label: '向上', symbol: '↑' },
    { direction: 'LEFT', label: '向左', symbol: '←' },
    { direction: 'DOWN', label: '向下', symbol: '↓' },
    { direction: 'RIGHT', label: '向右', symbol: '→' },
  ]

  return (
    <section className="snake-game" aria-label="贪吃蛇游戏">
      <header className="snake-heading">
        <div>
          <p className="snake-eyebrow">经典游艺 · 方寸之间</p>
          <h2>
            青玉游蛇 <span>步步生长，自得其乐</span>
          </h2>
        </div>
        <span className="snake-seal" aria-hidden="true">
          蛇趣
        </span>
      </header>

      <div className="snake-stats">
        <div className="snake-stat snake-stat-score">
          <span>本局得分</span>
          <strong>
            {String(score).padStart(2, '0')}
            <small>分</small>
          </strong>
        </div>
        <div className="snake-stat">
          <span>本次最高</span>
          <strong>
            {String(highScore).padStart(2, '0')}
            <small>分</small>
          </strong>
        </div>
        <div className="snake-stat">
          <span>蛇身长度</span>
          <strong>
            {String(snake.length).padStart(2, '0')}
            <small>节</small>
          </strong>
        </div>
      </div>

      <div className="snake-toolbar">
        <div className="snake-levels" role="group" aria-label="选择难度">
          {(Object.keys(CONFIG) as Level[]).map((lv) => (
            <button
              key={lv}
              type="button"
              disabled={!pickingIdle}
              aria-pressed={level === lv}
              onClick={() => setLevel(lv)}
            >
              {lv}
              <span>{lv === '简单' ? '悠然' : lv === '中等' ? '渐入' : '疾行'}</span>
            </button>
          ))}
        </div>
        <span className="snake-grid-size">
          {cfg.cols} × {cfg.rows}
          <span> 棋格</span>
        </span>
      </div>

      <div className="snake-board-frame">
        <div className="snake-board" style={{ aspectRatio: `${width} / ${height}` }}>
          <svg
            className="snake-field"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${level}难度棋盘，蛇身${snake.length}节，本局${score}分`}
          >
            <defs>
              <pattern
                id={`${artId}-grid`}
                width={cfg.cell}
                height={cfg.cell}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${cfg.cell} 0 H 0 V ${cfg.cell}`}
                  fill="none"
                  stroke="#52725d"
                  strokeOpacity=".16"
                  strokeWidth=".7"
                />
              </pattern>
              <linearGradient id={`${artId}-jade`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#84b694" />
                <stop offset=".42" stopColor="#478769" />
                <stop offset="1" stopColor="#245b47" />
              </linearGradient>
              <radialGradient id={`${artId}-head`} cx="30%" cy="25%" r="80%">
                <stop stopColor="#afd5a9" />
                <stop offset=".55" stopColor="#568d65" />
                <stop offset="1" stopColor="#24543c" />
              </radialGradient>
              <radialGradient id={`${artId}-fruit`} cx="30%" cy="25%" r="80%">
                <stop stopColor="#f3bc83" />
                <stop offset=".35" stopColor="#cd6b48" />
                <stop offset="1" stopColor="#943b2d" />
              </radialGradient>
              <filter id={`${artId}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="1.2"
                  floodColor="#243e2d"
                  floodOpacity=".3"
                />
              </filter>
            </defs>
            <rect width={width} height={height} fill={`url(#${artId}-grid)`} />
            <g filter={`url(#${artId}-shadow)`}>
              <polyline
                points={[...snake].reverse().map(center).join(' ')}
                fill="none"
                stroke="#24543f"
                strokeWidth={cfg.cell * 0.86}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={[...snake].reverse().map(center).join(' ')}
                fill="none"
                stroke={`url(#${artId}-jade)`}
                strokeWidth={cfg.cell * 0.73}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {snake.slice(1, -1).map((seg, i) => (
                <circle
                  key={i}
                  cx={(seg.x + 0.5) * cfg.cell}
                  cy={(seg.y + 0.42) * cfg.cell}
                  r={cfg.cell * 0.1}
                  fill="#c8dfb7"
                  opacity=".25"
                />
              ))}
              <g transform={`translate(${center(head)}) rotate(${angle})`}>
                <rect
                  x={-cfg.cell * 0.46}
                  y={-cfg.cell * 0.44}
                  width={cfg.cell * 0.92}
                  height={cfg.cell * 0.88}
                  rx={cfg.cell * 0.32}
                  fill={`url(#${artId}-head)`}
                  stroke="#2f6045"
                  strokeWidth=".8"
                />
                {[-1, 1].map((side) => (
                  <g key={side}>
                    <circle
                      cx={cfg.cell * 0.16}
                      cy={side * cfg.cell * 0.22}
                      r={cfg.cell * 0.12}
                      fill="#f5efcf"
                    />
                    <circle
                      cx={cfg.cell * 0.19}
                      cy={side * cfg.cell * 0.22}
                      r={cfg.cell * 0.063}
                      fill="#213d30"
                    />
                  </g>
                ))}
              </g>
              <g transform={`translate(${center(food)})`}>
                <circle
                  r={cfg.cell * 0.34}
                  cy={cfg.cell * 0.04}
                  fill={`url(#${artId}-fruit)`}
                  stroke="#a35639"
                  strokeWidth=".7"
                />
                <path
                  d={`M 0 ${-cfg.cell * 0.22} Q ${-cfg.cell * 0.02} ${-cfg.cell * 0.42} ${cfg.cell * 0.09} ${-cfg.cell * 0.46}`}
                  fill="none"
                  stroke="#695138"
                  strokeWidth="1.5"
                />
                <ellipse
                  cx={cfg.cell * 0.15}
                  cy={-cfg.cell * 0.3}
                  rx={cfg.cell * 0.16}
                  ry={cfg.cell * 0.075}
                  fill="#54744b"
                  transform="rotate(-20)"
                />
                <ellipse
                  cx={-cfg.cell * 0.13}
                  cy={-cfg.cell * 0.08}
                  rx={cfg.cell * 0.06}
                  ry={cfg.cell * 0.1}
                  fill="#ffe0b1"
                  opacity=".65"
                />
              </g>
            </g>
          </svg>

          {status !== 'playing' && (
            <div className={`snake-overlay snake-overlay-${status}`}>
              <div className="snake-dialog" role="group" aria-label={stateLabel}>
                <span className="snake-dialog-mark" aria-hidden="true">
                  {status === 'idle' ? '游' : status === 'paused' ? '歇' : '终'}
                </span>
                <h3>
                  {status === 'idle'
                    ? '一方天地，慢慢游'
                    : status === 'paused'
                      ? '小憩片刻'
                      : '此局落定'}
                </h3>
                <p>
                  {status === 'idle'
                    ? '拾一颗朱果，长一寸青玉。'
                    : status === 'paused'
                      ? '棋盘已为你留住，随时接着游。'
                      : `本局收获 ${score} 分 · 蛇身 ${snake.length} 节`}
                </p>
                <button
                  type="button"
                  className="snake-primary"
                  onClick={status === 'paused' ? togglePause : startGame}
                >
                  {status === 'idle' ? '开始游戏' : status === 'paused' ? '继续游戏' : '再来一局'}
                  <span aria-hidden="true">→</span>
                </button>
                {status === 'idle' && <small>也可按方向键 / WASD 开始</small>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="snake-board-caption">
        <span className={`snake-status is-${status}`} role="status">
          <i />
          {stateLabel}
        </span>
        <span>朱果 +10 分 · 越长越快</span>
      </div>

      <footer className="snake-controls">
        <div className="snake-control-notes">
          <div className="snake-speed">
            <span>当前节奏</span>
            <div
              role="meter"
              aria-label="加速进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(speedProgress * 100)}
            >
              <i style={{ width: `${15 + speedProgress * 85}%` }} />
            </div>
            <b>{speedProgress === 1 ? '疾速' : speedProgress > 0.4 ? '轻快' : '从容'}</b>
          </div>
          <p>
            <kbd>↑ ↓ ← →</kbd> / <kbd>W A S D</kbd> 控制方向
          </p>
          <p>避开边界与蛇身，吃到朱果即可生长。</p>
          <button
            type="button"
            className="snake-pause"
            disabled={pickingIdle}
            onClick={togglePause}
          >
            {status === 'paused' ? '▷ 继续游戏' : 'Ⅱ 暂停游戏'} <kbd>空格</kbd>
          </button>
        </div>
        <div className="snake-dpad" role="group" aria-label="方向控制">
          {directions.map(({ direction, label, symbol }) => (
            <button
              key={direction}
              type="button"
              className={`snake-direction snake-direction-${direction.toLowerCase()}`}
              aria-label={label}
              disabled={status === 'paused' || status === 'over'}
              data-active={dir === direction}
              onClick={() => changeDirection(direction)}
            >
              {symbol}
            </button>
          ))}
          <span>方向控制</span>
        </div>
      </footer>
    </section>
  )
}
