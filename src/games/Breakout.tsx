import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'ready' | 'playing' | 'won' | 'lost'

const W = 480
const H = 400
const BRICK_H = 18
const BRICK_TOP = 40

interface Cfg {
  rows: number
  cols: number
  paddle: number
  ballSpeed: number
}

const CONFIG: Record<Level, Cfg> = {
  简单: { rows: 5, cols: 8, paddle: 100, ballSpeed: 4.5 },
  中等: { rows: 7, cols: 10, paddle: 80, ballSpeed: 5.5 },
  复杂: { rows: 9, cols: 12, paddle: 60, ballSpeed: 7 },
}

const ROW_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#38bdf8', '#a855f7', '#f472b6', '#60a5fa', '#f87171']

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

interface Brick {
  x: number
  y: number
  w: number
  h: number
  row: number
  alive: boolean
}

function makeBricks(cfg: Cfg): Brick[] {
  const bw = W / cfg.cols
  const bricks: Brick[] = []
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      bricks.push({
        x: c * bw,
        y: BRICK_TOP + r * BRICK_H,
        w: bw,
        h: BRICK_H,
        row: r,
        alive: true,
      })
    }
  }
  return bricks
}

export default function Breakout({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const statusRef = useRef<Status>(status)
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const paddleXRef = useRef(W / 2)
  const ballRef = useRef<Ball>({ x: W / 2, y: H - 40, vx: 0, vy: 0, r: 6 })
  const bricksRef = useRef<Brick[]>([])
  const cfgRef = useRef<Cfg>(CONFIG[level])
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)

  statusRef.current = status
  scoreRef.current = score
  livesRef.current = lives

  const submitEnd = useCallback(
    async (result: 'win' | 'lose', finalScore: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const dur = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      try {
        await createRecord(userId, { gameId, score: finalScore, duration: dur, result })
      } catch {}
    },
    [userId, gameId]
  )

  const resetLayout = useCallback(() => {
    const cfg = CONFIG[level]
    cfgRef.current = cfg
    bricksRef.current = makeBricks(cfg)
    paddleXRef.current = W / 2
    ballRef.current = { x: W / 2, y: H - 40, vx: 0, vy: 0, r: 6 }
    setScore(0); scoreRef.current = 0
    setLives(3); livesRef.current = 3
    setStatus('idle')
    statusRef.current = 'idle'
    submittedRef.current = false
    draw()
  }, [level])

  useEffect(() => {
    resetLayout()
  }, [level, resetLayout])

  const stickBallOnPaddle = () => {
    ballRef.current = {
      x: paddleXRef.current,
      y: H - 30 - 6,
      vx: 0,
      vy: 0,
      r: 6,
    }
  }

  const launchBall = () => {
    const cfg = cfgRef.current
    const angle = (Math.random() * 0.6 - 0.3) + -Math.PI / 2
    ballRef.current.vx = Math.cos(angle) * cfg.ballSpeed
    ballRef.current.vy = Math.sin(angle) * cfg.ballSpeed
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#1f1333'
    ctx.fillRect(0, 0, W, H)

    // 砖块
    const bricks = bricksRef.current
    for (const b of bricks) {
      if (!b.alive) continue
      ctx.fillStyle = ROW_COLORS[b.row % ROW_COLORS.length]
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2)
    }

    // 挡板
    const cfg = cfgRef.current
    const px = paddleXRef.current - cfg.paddle / 2
    ctx.fillStyle = '#ff6b35'
    ctx.fillRect(px, H - 20, cfg.paddle, 10)

    // 球
    const ball = ballRef.current
    ctx.fillStyle = '#fbbf24'
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const step = useCallback(() => {
    const st = statusRef.current
    if (st !== 'playing' && st !== 'ready') {
      rafRef.current = null
      return
    }

    const ball = ballRef.current
    const cfg = cfgRef.current

    if (st === 'ready') {
      ball.x = paddleXRef.current
      ball.y = H - 30 - ball.r
    } else {
      ball.x += ball.vx
      ball.y += ball.vy

      if (ball.x - ball.r < 0) {
        ball.x = ball.r
        ball.vx = -ball.vx
      } else if (ball.x + ball.r > W) {
        ball.x = W - ball.r
        ball.vx = -ball.vx
      }
      if (ball.y - ball.r < 0) {
        ball.y = ball.r
        ball.vy = -ball.vy
      }

      // 挡板碰撞
      const py = H - 20
      const px = paddleXRef.current - cfg.paddle / 2
      if (
        ball.y + ball.r >= py &&
        ball.y - ball.r <= py + 10 &&
        ball.x >= px &&
        ball.x <= px + cfg.paddle &&
        ball.vy > 0
      ) {
        const hit = (ball.x - paddleXRef.current) / (cfg.paddle / 2)
        const angle = hit * (Math.PI / 3) - Math.PI / 2
        const sp = cfg.ballSpeed
        ball.vx = Math.cos(angle) * sp
        ball.vy = Math.sin(angle) * sp
        ball.y = py - ball.r - 1
      }

      // 砖块碰撞
      const bricks = bricksRef.current
      for (const b of bricks) {
        if (!b.alive) continue
        if (
          ball.x + ball.r > b.x &&
          ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y &&
          ball.y - ball.r < b.y + b.h
        ) {
          b.alive = false
          const prevX = ball.x - ball.vx
          const prevY = ball.y - ball.vy
          const wasOutsideX = prevX + ball.r <= b.x || prevX - ball.r >= b.x + b.w
          if (wasOutsideX) ball.vx = -ball.vx
          else ball.vy = -ball.vy
          setScore(s => {
            const ns = s + 10
            scoreRef.current = ns
            return ns
          })
          break
        }
      }

      // 球落底
      if (ball.y - ball.r > H) {
        const left = livesRef.current - 1
        livesRef.current = left
        setLives(left)
        if (left <= 0) {
          setStatus('lost')
          statusRef.current = 'lost'
          void submitEnd('lose', scoreRef.current)
          draw()
          return
        }
        setStatus('ready')
        statusRef.current = 'ready'
        stickBallOnPaddle()
      }

      // 胜利
      if (bricksRef.current.every(b => !b.alive)) {
        const bonus = livesRef.current * 50
        const final = scoreRef.current + bonus
        scoreRef.current = final
        setScore(final)
        setStatus('won')
        statusRef.current = 'won'
        void submitEnd('win', final)
        draw()
        return
      }
    }

    draw()
    rafRef.current = requestAnimationFrame(step)
  }, [draw, submitEnd])

  useEffect(() => {
    if (status === 'playing' || status === 'ready') {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [status, step])

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    paddleXRef.current = Math.max(cfgRef.current.paddle / 2, Math.min(W - cfgRef.current.paddle / 2, x))
    if (statusRef.current === 'idle' || statusRef.current === 'ready') {
      draw()
    }
  }

  const onCanvasClick = () => {
    if (statusRef.current === 'idle' || statusRef.current === 'ready') {
      if (statusRef.current === 'idle') {
        startTimeRef.current = Date.now()
      }
      stickBallOnPaddle()
      launchBall()
      setStatus('playing')
      statusRef.current = 'playing'
    }
  }

  const restart = () => {
    resetLayout()
  }

  const pickingIdle = status === 'idle' || status === 'won' || status === 'lost'

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap gap-2 justify-center">
        {(['简单', '中等', '复杂'] as const).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!pickingIdle}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-accent text-white border-fun-accent'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-accent/50'
            } ${!pickingIdle ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl px-4 py-2 text-center shadow-card min-w-[90px]">
          <p className="text-2xl font-black text-fun-accent">⭐ {score}</p>
          <p className="text-xs text-fun-muted font-semibold">得分</p>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-2 text-center shadow-card min-w-[90px]">
          <p className="text-2xl font-black text-red-500">{'❤️'.repeat(Math.max(0, lives))}</p>
          <p className="text-xs text-fun-muted font-semibold">命数</p>
        </div>
      </div>

      <div className="relative border-4 border-fun-border rounded-2xl overflow-hidden shadow-card">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onMouseMove={onMouseMove}
          onClick={onCanvasClick}
          className="block cursor-none"
        />
        {status === 'idle' && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 text-white">
            <p className="text-xl font-black">🏓 打砖块</p>
            <p className="text-sm">鼠标控制挡板，点击画面发球</p>
          </div>
        )}
        {status === 'ready' && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold">
            点击画面发球
          </div>
        )}
        {status === 'won' && (
          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-2 text-white">
            <p className="text-3xl">🎉</p>
            <p className="text-xl font-black">通关！</p>
            <p className="text-sm">最终得分 <span className="text-fun-yellow font-black text-2xl">{score}</span></p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 px-6 py-2 rounded-full bg-fun-green text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
            >
              再玩一次
            </button>
          </div>
        )}
        {status === 'lost' && (
          <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-2 text-white">
            <p className="text-3xl">💔</p>
            <p className="text-xl font-black">失败了</p>
            <p className="text-sm">得分 <span className="text-fun-yellow font-black text-2xl">{score}</span></p>
            <button
              type="button"
              onClick={restart}
              className="mt-2 px-6 py-2 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
            >
              再来一局
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
