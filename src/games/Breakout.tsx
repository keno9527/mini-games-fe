import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'ready' | 'playing' | 'won' | 'lost'

const W = 720
const H = 520
const BRICK_H = 22
const BRICK_TOP = 48
const PADDLE_Y = H - 34
const PADDLE_H = 12
const BALL_R = 7
const POWERUP_DROP_RATE = 0.2
const MAX_BALLS = 6

interface Cfg {
  rows: number
  cols: number
  paddle: number
  ballSpeed: number
}

const CONFIG: Record<Level, Cfg> = {
  简单: { rows: 5, cols: 8, paddle: 150, ballSpeed: 5.6 },
  中等: { rows: 7, cols: 10, paddle: 125, ballSpeed: 6.6 },
  复杂: { rows: 9, cols: 12, paddle: 100, ballSpeed: 8 },
}

const ROW_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#38bdf8', '#a855f7', '#f472b6', '#60a5fa', '#f87171']
const POWERUP_TYPES = ['multi', 'fast', 'slow', 'wide'] as const
type PowerupType = typeof POWERUP_TYPES[number]

const POWERUP_META: Record<PowerupType, { icon: string; label: string; color: string }> = {
  multi: { icon: '✦', label: '多球', color: '#a855f7' },
  fast: { icon: '⚡', label: '加速', color: '#f59e0b' },
  slow: { icon: '❄', label: '减速', color: '#38bdf8' },
  wide: { icon: '↔', label: '宽板', color: '#34d399' },
}

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

interface Powerup {
  id: number
  type: PowerupType
  x: number
  y: number
  vy: number
  size: number
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
  const [ballCount, setBallCount] = useState(1)
  const [speedText, setSpeedText] = useState(CONFIG[level].ballSpeed)
  const [powerupMessage, setPowerupMessage] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const statusRef = useRef<Status>(status)
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const ballCountRef = useRef(1)
  const paddleXRef = useRef(W / 2)
  const ballsRef = useRef<Ball[]>([{ x: W / 2, y: H - 40, vx: 0, vy: 0, r: BALL_R }])
  const bricksRef = useRef<Brick[]>([])
  const powerupsRef = useRef<Powerup[]>([])
  const cfgRef = useRef<Cfg>(CONFIG[level])
  const speedRef = useRef(CONFIG[level].ballSpeed)
  const paddleWidthRef = useRef(CONFIG[level].paddle)
  const powerupIdRef = useRef(0)
  const messageTimerRef = useRef<number | null>(null)
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

  const setBallCountSafe = (next: number) => {
    if (ballCountRef.current !== next) {
      ballCountRef.current = next
      setBallCount(next)
    }
  }

  const resetLayout = useCallback(() => {
    const cfg = CONFIG[level]
    cfgRef.current = cfg
    speedRef.current = cfg.ballSpeed
    paddleWidthRef.current = cfg.paddle
    bricksRef.current = makeBricks(cfg)
    powerupsRef.current = []
    paddleXRef.current = W / 2
    ballsRef.current = [{ x: W / 2, y: H - 40, vx: 0, vy: 0, r: BALL_R }]
    setBallCountSafe(1)
    setSpeedText(cfg.ballSpeed)
    setPowerupMessage('')
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

  useEffect(() => {
    return () => {
      if (messageTimerRef.current != null) {
        window.clearTimeout(messageTimerRef.current)
      }
    }
  }, [])

  const stickBallOnPaddle = () => {
    ballsRef.current = [{
      x: paddleXRef.current,
      y: PADDLE_Y - BALL_R - 2,
      vx: 0,
      vy: 0,
      r: BALL_R,
    }]
    setBallCountSafe(1)
  }

  const launchBall = () => {
    const angle = (Math.random() * 0.6 - 0.3) + -Math.PI / 2
    const ball = ballsRef.current[0]
    if (!ball) return
    ball.vx = Math.cos(angle) * speedRef.current
    ball.vy = Math.sin(angle) * speedRef.current
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

    for (const p of powerupsRef.current) {
      const meta = POWERUP_META[p.type]
      ctx.fillStyle = meta.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'
      ctx.lineWidth = 2
      ctx.strokeRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
      ctx.fillStyle = '#0a0e27'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(meta.icon, p.x, p.y + 1)
    }

    // 挡板
    const paddleWidth = paddleWidthRef.current
    const px = paddleXRef.current - paddleWidth / 2
    ctx.fillStyle = '#ff6b35'
    ctx.fillRect(px, PADDLE_Y, paddleWidth, PADDLE_H)
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.fillRect(px + 8, PADDLE_Y + 2, Math.max(8, paddleWidth - 16), 2)

    for (const ball of ballsRef.current) {
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.arc(ball.x - 2, ball.y - 2, ball.r / 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [])

  const showPowerupMessage = useCallback((type: PowerupType) => {
    const meta = POWERUP_META[type]
    setPowerupMessage(`${meta.icon} ${meta.label}`)
    if (messageTimerRef.current != null) {
      window.clearTimeout(messageTimerRef.current)
    }
    messageTimerRef.current = window.setTimeout(() => {
      setPowerupMessage('')
      messageTimerRef.current = null
    }, 1200)
  }, [])

  const normalizeBallSpeed = (ball: Ball, speed: number) => {
    const current = Math.hypot(ball.vx, ball.vy) || 1
    ball.vx = (ball.vx / current) * speed
    ball.vy = (ball.vy / current) * speed
  }

  const changeSpeed = (multiplier: number) => {
    const base = cfgRef.current.ballSpeed
    const next = Math.max(base * 0.7, Math.min(base * 1.8, speedRef.current * multiplier))
    speedRef.current = next
    setSpeedText(next)
    ballsRef.current.forEach(ball => {
      if (ball.vx !== 0 || ball.vy !== 0) normalizeBallSpeed(ball, next)
    })
  }

  const splitBalls = () => {
    const source = ballsRef.current.length ? ballsRef.current : [{
      x: paddleXRef.current,
      y: PADDLE_Y - BALL_R - 2,
      vx: 0,
      vy: -speedRef.current,
      r: BALL_R,
    }]
    const additions: Ball[] = []

    for (const ball of source) {
      if (source.length + additions.length >= MAX_BALLS) break
      const speed = Math.hypot(ball.vx, ball.vy) || speedRef.current
      const baseAngle = Math.atan2(ball.vy || -speed, ball.vx || 0)
      for (const offset of [-0.42, 0.42]) {
        if (source.length + additions.length >= MAX_BALLS) break
        const angle = baseAngle + offset
        additions.push({
          x: ball.x,
          y: ball.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: ball.r,
        })
      }
    }

    ballsRef.current = [...source, ...additions].slice(0, MAX_BALLS)
    setBallCountSafe(ballsRef.current.length)
  }

  const applyPowerup = useCallback((type: PowerupType) => {
    if (type === 'multi') {
      splitBalls()
    } else if (type === 'fast') {
      changeSpeed(1.18)
    } else if (type === 'slow') {
      changeSpeed(0.84)
    } else if (type === 'wide') {
      paddleWidthRef.current = Math.min(W * 0.45, paddleWidthRef.current + 38)
    }
    showPowerupMessage(type)
  }, [showPowerupMessage])

  const spawnPowerup = (brick: Brick) => {
    if (Math.random() > POWERUP_DROP_RATE) return
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
    powerupsRef.current.push({
      id: powerupIdRef.current++,
      type,
      x: brick.x + brick.w / 2,
      y: brick.y + brick.h / 2,
      vy: 2.6,
      size: 24,
    })
  }

  const updatePowerups = () => {
    const paddleWidth = paddleWidthRef.current
    const px = paddleXRef.current - paddleWidth / 2
    const next: Powerup[] = []

    for (const powerup of powerupsRef.current) {
      powerup.y += powerup.vy
      const hitPaddle =
        powerup.y + powerup.size / 2 >= PADDLE_Y &&
        powerup.y - powerup.size / 2 <= PADDLE_Y + PADDLE_H &&
        powerup.x >= px &&
        powerup.x <= px + paddleWidth

      if (hitPaddle) {
        applyPowerup(powerup.type)
      } else if (powerup.y - powerup.size / 2 <= H) {
        next.push(powerup)
      }
    }

    powerupsRef.current = next
  }

  const step = useCallback(() => {
    const st = statusRef.current
    if (st !== 'playing' && st !== 'ready') {
      rafRef.current = null
      return
    }

    if (st === 'ready') {
      const ball = ballsRef.current[0]
      if (ball) {
        ball.x = paddleXRef.current
        ball.y = PADDLE_Y - ball.r - 2
      }
    } else {
      const nextBalls: Ball[] = []
      const paddleWidth = paddleWidthRef.current
      const px = paddleXRef.current - paddleWidth / 2

      for (const ball of ballsRef.current) {
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
        if (
          ball.y + ball.r >= PADDLE_Y &&
          ball.y - ball.r <= PADDLE_Y + PADDLE_H &&
          ball.x >= px &&
          ball.x <= px + paddleWidth &&
          ball.vy > 0
        ) {
          const hit = (ball.x - paddleXRef.current) / (paddleWidth / 2)
          const angle = hit * (Math.PI / 3) - Math.PI / 2
          const sp = speedRef.current
          ball.vx = Math.cos(angle) * sp
          ball.vy = Math.sin(angle) * sp
          ball.y = PADDLE_Y - ball.r - 1
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
            spawnPowerup(b)
            const prevX = ball.x - ball.vx
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

        if (ball.y - ball.r <= H) {
          nextBalls.push(ball)
        }
      }

      ballsRef.current = nextBalls
      setBallCountSafe(nextBalls.length)
      updatePowerups()

      // 所有球落底才扣命
      if (nextBalls.length === 0) {
        const left = livesRef.current - 1
        livesRef.current = left
        setLives(left)
        powerupsRef.current = []
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

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const paddleWidth = paddleWidthRef.current
    paddleXRef.current = Math.max(paddleWidth / 2, Math.min(W - paddleWidth / 2, x))
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
        <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl px-4 py-2 text-center shadow-card min-w-[90px]">
          <p className="text-2xl font-black text-purple-500">×{ballCount}</p>
          <p className="text-xs text-fun-muted font-semibold">球数</p>
        </div>
        <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl px-4 py-2 text-center shadow-card min-w-[90px]">
          <p className="text-2xl font-black text-sky-500">{speedText.toFixed(1)}</p>
          <p className="text-xs text-fun-muted font-semibold">速度</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black text-white">
        {POWERUP_TYPES.map(type => {
          const meta = POWERUP_META[type]
          return (
            <span
              key={type}
              className="px-2 py-1 rounded-full border-2 border-white/30"
              style={{ backgroundColor: meta.color }}
            >
              {meta.icon} {meta.label}
            </span>
          )
        })}
      </div>

      <div className="relative w-full max-w-[860px] aspect-[18/13] border-4 border-fun-border rounded-2xl overflow-hidden shadow-card">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerMove={onPointerMove}
          onClick={onCanvasClick}
          className="block w-full h-full cursor-none touch-none"
        />
        {powerupMessage && (
          <div className="pointer-events-none absolute top-4 right-4 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-black border-2 border-white/30">
            {powerupMessage}
          </div>
        )}
        {status === 'idle' && (
          <div className="pointer-events-none absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 text-white">
            <p className="text-xl font-black">🏓 打砖块</p>
            <p className="text-sm">鼠标或触控控制挡板，点击画面发球</p>
          </div>
        )}
        {status === 'ready' && (
          <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold">
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
