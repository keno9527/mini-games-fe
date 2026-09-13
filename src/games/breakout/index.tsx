import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '@/api'
import '../game-surfaces.css'
import { LEVEL_LAYOUTS } from './levels'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'ready' | 'playing' | 'won' | 'lost'
type PowerUpType = 'wider' | 'multiball' | 'laser' | 'slow' | 'pierce' | 'life'
type BrickType = 'normal' | 'hard' | 'explosive' | 'indestructible'

// ===== 画布常量 =====
const W = 480
const H = 520
const RENDER_SCALE = 2
const BRICK_H = 20
const BRICK_TOP = 52
const PADDLE_Y = H - 32
const PADDLE_H = 12
const BALL_R = 6
const POWERUP_SIZE = 22
const POWERUP_SPEED = 2.4
const LASER_W = 3
const LASER_H = 14
const LASER_SPEED = 9
const LASER_COOLDOWN = 16 // frames
const EFFECT_FRAMES = 540 // 9s @ 60fps
const MAX_PARTICLES = 220

// ===== 难度配置 =====
interface Cfg {
  paddle: number
  ballSpeed: number
  powerUpRate: number
  maxLevel: number
}

const CONFIG: Record<Level, Cfg> = {
  简单: { paddle: 110, ballSpeed: 4.5, powerUpRate: 0.28, maxLevel: 0 },
  中等: { paddle: 88, ballSpeed: 5.6, powerUpRate: 0.2, maxLevel: 1 },
  复杂: { paddle: 66, ballSpeed: 7, powerUpRate: 0.14, maxLevel: 2 },
}

const BRICK_COLORS = [
  '#d88978',
  '#d9a56c',
  '#dcca87',
  '#87bba0',
  '#7bbdc5',
  '#7d9dbd',
  '#9e94c4',
  '#c28da8',
  '#74b5b1',
  '#c78687',
]

const POWERUP_META: Record<
  PowerUpType,
  { color: string; glow: string; label: string; name: string }
> = {
  wider: { color: '#047857', glow: '#34d399', label: 'W', name: '加宽挡板' },
  multiball: { color: '#0369a1', glow: '#38bdf8', label: 'M', name: '多球' },
  laser: { color: '#b91c1c', glow: '#f87171', label: 'L', name: '激光炮' },
  slow: { color: '#0e7490', glow: '#22d3ee', label: 'S', name: '减速' },
  pierce: { color: '#6d28d9', glow: '#a855f7', label: 'P', name: '穿透球' },
  life: { color: '#be185d', glow: '#f472b6', label: '♥', name: '额外生命' },
}

const POWERUP_TYPES: PowerUpType[] = ['wider', 'multiball', 'laser', 'slow', 'pierce', 'life']

// ===== 实体类型 =====
interface Brick {
  x: number
  y: number
  w: number
  h: number
  row: number
  col: number
  type: BrickType
  hp: number
  maxHp: number
  alive: boolean
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  piercing: boolean
}

interface PowerUp {
  x: number
  y: number
  type: PowerUpType
}

interface Laser {
  x: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

interface Effects {
  wider: number
  laser: number
  slow: number
  pierce: number
}

// ===== 工具函数 =====
function parseBricks(layout: string[]): Brick[] {
  const cols = layout[0].length
  const bw = W / cols
  const bricks: Brick[] = []
  for (let r = 0; r < layout.length; r++) {
    const row = layout[r]
    for (let c = 0; c < cols; c++) {
      const ch = row[c]
      if (ch === '.' || ch === ' ') continue
      let type: BrickType = 'normal'
      let hp = 1
      if (ch === 'H') {
        type = 'hard'
        hp = 2
      } else if (ch === 'X') {
        type = 'explosive'
        hp = 1
      } else if (ch === '#') {
        type = 'indestructible'
        hp = 999
      }
      bricks.push({
        x: c * bw,
        y: BRICK_TOP + r * BRICK_H,
        w: bw,
        h: BRICK_H,
        row: r,
        col: c,
        type,
        hp,
        maxHp: hp,
        alive: true,
      })
    }
  }
  return bricks
}

function brickColor(b: Brick): string {
  if (b.type === 'hard') return '#94a3b8'
  if (b.type === 'explosive') return '#ef4444'
  if (b.type === 'indestructible') return '#475569'
  return BRICK_COLORS[b.row % BRICK_COLORS.length]
}

function brickScore(b: Brick): number {
  if (b.type === 'hard') return 30
  if (b.type === 'explosive') return 20
  return 10
}

function randPowerUp(): PowerUpType {
  // life 稀有
  const r = Math.random()
  if (r < 0.06) return 'life'
  return POWERUP_TYPES[Math.floor(Math.random() * 5)]
}

export default function Breakout({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [levelIdx, setLevelIdx] = useState(0)
  const [combo, setCombo] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const statusRef = useRef<Status>('idle')
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const levelIdxRef = useRef(0)
  const comboRef = useRef(0)
  const comboTimerRef = useRef(0)

  const paddleXRef = useRef(W / 2)
  const ballsRef = useRef<Ball[]>([])
  const bricksRef = useRef<Brick[]>([])
  const powerupsRef = useRef<PowerUp[]>([])
  const lasersRef = useRef<Laser[]>([])
  const particlesRef = useRef<Particle[]>([])
  const effectsRef = useRef<Effects>({ wider: 0, laser: 0, slow: 0, pierce: 0 })
  const laserCdRef = useRef(0)
  const cfgRef = useRef<Cfg>(CONFIG['中等'])
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)
  const flashRef = useRef(0) // 屏幕闪烁
  const keysRef = useRef<Set<string>>(new Set()) // 键盘按下状态
  const PADDLE_KEY_SPEED = 8

  statusRef.current = status

  // ===== 成绩提交 =====
  const submitEnd = useCallback(
    async (result: 'win' | 'lose', finalScore: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const dur = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      try {
        await createRecord(userId, { gameId, score: finalScore, duration: dur, result })
      } catch {
        /* ignore */
      }
    },
    [userId, gameId],
  )

  // ===== 粒子生成 =====
  const spawnParticles = (x: number, y: number, color: string, count: number, speed = 3) => {
    const arr = particlesRef.current
    for (let i = 0; i < count; i++) {
      if (arr.length >= MAX_PARTICLES) break
      const a = Math.random() * Math.PI * 2
      const s = Math.random() * speed + 1
      const life = 20 + Math.random() * 25
      arr.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        color,
        size: 2 + Math.random() * 3,
      })
    }
  }

  // ===== 砖块伤害 / 摧毁 =====
  const damageBrick = (b: Brick): number => {
    if (!b.alive) return 0
    if (b.type === 'indestructible') {
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#94a3b8', 4, 2)
      return 0
    }
    b.hp -= 1
    if (b.hp > 0) {
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, brickColor(b), 5, 2.5)
      return 5
    }
    return destroyBrick(b)
  }

  const destroyBrick = (b: Brick): number => {
    if (!b.alive) return 0
    b.alive = false
    const color = brickColor(b)
    spawnParticles(b.x + b.w / 2, b.y + b.h / 2, color, 10, 3.5)

    // 连击加成
    comboRef.current += 1
    comboTimerRef.current = 90
    const multiplier = 1 + Math.min(comboRef.current, 15) * 0.1
    const gained = Math.round(brickScore(b) * multiplier)

    // 道具掉落
    if (b.type !== 'indestructible' && Math.random() < cfgRef.current.powerUpRate) {
      powerupsRef.current.push({
        x: b.x + b.w / 2,
        y: b.y + b.h / 2,
        type: randPowerUp(),
      })
    }

    // 爆炸连锁
    if (b.type === 'explosive') {
      flashRef.current = 8
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#fbbf24', 18, 5)
      let chain = 0
      for (const other of bricksRef.current) {
        if (!other.alive || other === b) continue
        if (Math.abs(other.row - b.row) <= 1 && Math.abs(other.col - b.col) <= 1) {
          chain += damageBrick(other)
        }
      }
      return gained + chain
    }
    return gained
  }

  // ===== 重置整局 =====
  const resetGame = useCallback(() => {
    const cfg = CONFIG[level]
    cfgRef.current = cfg
    bricksRef.current = parseBricks(LEVEL_LAYOUTS[0])
    paddleXRef.current = W / 2
    ballsRef.current = []
    powerupsRef.current = []
    lasersRef.current = []
    particlesRef.current = []
    effectsRef.current = { wider: 0, laser: 0, slow: 0, pierce: 0 }
    laserCdRef.current = 0
    comboRef.current = 0
    comboTimerRef.current = 0
    flashRef.current = 0
    levelIdxRef.current = 0
    setLevelIdx(0)
    setScore(0)
    scoreRef.current = 0
    setLives(3)
    livesRef.current = 3
    setCombo(0)
    setStatus('idle')
    statusRef.current = 'idle'
    submittedRef.current = false
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  useEffect(() => {
    resetGame()
  }, [level, resetGame])

  // ===== 进入下一关 =====
  const nextLevel = () => {
    const next = levelIdxRef.current + 1
    levelIdxRef.current = next
    setLevelIdx(next)
    bricksRef.current = parseBricks(LEVEL_LAYOUTS[next])
    ballsRef.current = []
    powerupsRef.current = []
    lasersRef.current = []
    effectsRef.current = { wider: 0, laser: 0, slow: 0, pierce: 0 }
    comboRef.current = 0
    comboTimerRef.current = 0
    setCombo(0)
    setStatus('ready')
    statusRef.current = 'ready'
    stickBallOnPaddle()
    draw()
  }

  // ===== 球操作 =====
  const stickBallOnPaddle = () => {
    ballsRef.current = [
      {
        x: paddleXRef.current,
        y: PADDLE_Y - BALL_R - 1,
        vx: 0,
        vy: 0,
        r: BALL_R,
        piercing: false,
      },
    ]
  }

  const launchBall = () => {
    const cfg = cfgRef.current
    const angle = Math.random() * 0.6 - 0.3 - Math.PI / 2
    const sp = cfg.ballSpeed
    for (const ball of ballsRef.current) {
      ball.vx = Math.cos(angle) * sp
      ball.vy = Math.sin(angle) * sp
    }
  }

  const currentPaddleWidth = () => {
    return effectsRef.current.wider > 0 ? cfgRef.current.paddle * 1.5 : cfgRef.current.paddle
  }

  // ===== 道具拾取 =====
  const applyPowerUp = (type: PowerUpType) => {
    const eff = effectsRef.current
    switch (type) {
      case 'wider':
        eff.wider = EFFECT_FRAMES
        break
      case 'laser':
        eff.laser = EFFECT_FRAMES
        break
      case 'slow':
        eff.slow = EFFECT_FRAMES
        // 立即减速所有球
        for (const b of ballsRef.current) {
          b.vx *= 0.7
          b.vy *= 0.7
        }
        break
      case 'pierce':
        eff.pierce = EFFECT_FRAMES
        for (const b of ballsRef.current) b.piercing = true
        break
      case 'multiball': {
        const src = ballsRef.current
        const newBalls: Ball[] = []
        for (const b of src) {
          if (b.vx === 0 && b.vy === 0) continue
          const spd = Math.hypot(b.vx, b.vy) || cfgRef.current.ballSpeed
          const baseAngle = Math.atan2(b.vy, b.vx)
          for (const offset of [-0.35, 0, 0.35]) {
            newBalls.push({
              x: b.x,
              y: b.y,
              vx: Math.cos(baseAngle + offset) * spd,
              vy: Math.sin(baseAngle + offset) * spd,
              r: BALL_R,
              piercing: eff.pierce > 0,
            })
          }
        }
        if (newBalls.length > 0) ballsRef.current = newBalls.slice(0, 12)
        break
      }
      case 'life':
        livesRef.current = Math.min(livesRef.current + 1, 9)
        setLives(livesRef.current)
        break
    }
  }

  // ===== 绘制 =====
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0)

    // 背景
    const background = ctx.createLinearGradient(0, 0, W, H)
    background.addColorStop(0, '#163a46')
    background.addColorStop(1, '#091923')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, W, H)

    // 顶部网格装饰
    ctx.strokeStyle = 'rgba(166,205,210,0.045)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // 砖块
    for (const b of bricksRef.current) {
      if (!b.alive) continue
      const color = brickColor(b)
      ctx.shadowColor = '#00000055'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 3
      const brickGradient = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h)
      brickGradient.addColorStop(0, color)
      brickGradient.addColorStop(1, color + 'bb')
      ctx.fillStyle = brickGradient
      ctx.beginPath()
      ctx.roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 3)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(b.x + 3, b.y + b.h - 5, b.w - 6, 3)
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 3)
      // 边框
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2)
      // 加固砖块裂纹
      if (b.type === 'hard' && b.hp < b.maxHp) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.beginPath()
        ctx.moveTo(b.x + b.w * 0.3, b.y + 2)
        ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.5)
        ctx.lineTo(b.x + b.w * 0.4, b.y + b.h - 2)
        ctx.stroke()
      }
      // 爆炸砖块标记
      if (b.type === 'explosive') {
        ctx.fillStyle = '#fef3c7'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✸', b.x + b.w / 2, b.y + b.h / 2)
      }
      // 不可破坏砖块
      if (b.type === 'indestructible') {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6)
      }
    }

    // 道具
    for (const p of powerupsRef.current) {
      const meta = POWERUP_META[p.type]
      const x = p.x - POWERUP_SIZE / 2
      const y = p.y - POWERUP_SIZE / 2
      ctx.shadowColor = meta.glow
      ctx.shadowBlur = 10
      ctx.fillStyle = meta.color
      ctx.beginPath()
      ctx.roundRect(x, y, POWERUP_SIZE, POWERUP_SIZE, 5)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.strokeText(meta.label, p.x, p.y + 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(meta.label, p.x, p.y + 1)
    }

    // 激光
    ctx.fillStyle = '#fca5a5'
    for (const l of lasersRef.current) {
      ctx.fillRect(l.x - LASER_W / 2, l.y - LASER_H / 2, LASER_W, LASER_H)
      ctx.fillStyle = '#fee2e2'
      ctx.fillRect(l.x - 1, l.y - LASER_H / 2, 2, LASER_H)
      ctx.fillStyle = '#fca5a5'
    }

    // 挡板
    const pw = currentPaddleWidth()
    const px = paddleXRef.current - pw / 2
    const hasLaser = effectsRef.current.laser > 0
    // 挡板主体
    const grad = ctx.createLinearGradient(px, PADDLE_Y, px, PADDLE_Y + PADDLE_H)
    grad.addColorStop(0, hasLaser ? '#ffad9b' : '#f4e1b9')
    grad.addColorStop(1, hasLaser ? '#ba5d52' : '#aa8556')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(px, PADDLE_Y, pw, PADDLE_H, 4)
    ctx.fill()
    // 激光炮管
    if (hasLaser) {
      ctx.fillStyle = '#7f1d1d'
      ctx.fillRect(px + 6, PADDLE_Y - 5, 5, 6)
      ctx.fillRect(px + pw - 11, PADDLE_Y - 5, 5, 6)
    }

    // 球
    for (const ball of ballsRef.current) {
      ctx.shadowBlur = 12
      ctx.shadowColor = ball.piercing ? '#c084fc' : '#f4e5bd'
      // 拖尾
      if (ball.vx !== 0 || ball.vy !== 0) {
        ctx.fillStyle = ball.piercing ? 'rgba(168,85,247,0.25)' : 'rgba(251,191,36,0.2)'
        ctx.beginPath()
        ctx.arc(ball.x - ball.vx * 1.5, ball.y - ball.vy * 1.5, ball.r * 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = ball.piercing ? '#c084fc' : '#fbbf24'
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath()
      ctx.arc(ball.x - 2, ball.y - 2, ball.r * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.shadowBlur = 0

    // 粒子
    for (const p of particlesRef.current) {
      const alpha = p.life / p.maxLife
      ctx.globalAlpha = alpha
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    }
    ctx.globalAlpha = 1

    // 屏幕闪烁（爆炸）
    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(255,220,100,${flashRef.current / 20})`
      ctx.fillRect(0, 0, W, H)
    }

    // 顶部效果指示器
    const eff = effectsRef.current
    let iconX = 8
    const drawEffectIcon = (type: PowerUpType, frames: number) => {
      if (frames <= 0) return
      const meta = POWERUP_META[type]
      const size = 18
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      ctx.roundRect(iconX, 6, size + 4, size + 4, 4)
      ctx.fill()
      ctx.shadowColor = meta.glow
      ctx.shadowBlur = 6
      ctx.fillStyle = meta.color
      ctx.beginPath()
      ctx.roundRect(iconX + 2, 8, size, size, 3)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.font = 'bold 10px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 2.5
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'
      ctx.strokeText(meta.label, iconX + 2 + size / 2, 8 + size / 2 + 1)
      ctx.fillStyle = '#fff'
      ctx.fillText(meta.label, iconX + 2 + size / 2, 8 + size / 2 + 1)
      const ratio = frames / EFFECT_FRAMES
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(iconX + 2, 8 + size + 1, size, 2)
      ctx.fillStyle = meta.glow
      ctx.fillRect(iconX + 2, 8 + size + 1, size * ratio, 2)
      iconX += size + 10
    }
    drawEffectIcon('wider', eff.wider)
    drawEffectIcon('laser', eff.laser)
    drawEffectIcon('slow', eff.slow)
    drawEffectIcon('pierce', eff.pierce)
  }, [])

  // ===== 游戏主循环 =====
  const step = useCallback(() => {
    const st = statusRef.current
    if (st !== 'playing' && st !== 'ready') {
      rafRef.current = null
      return
    }

    const cfg = cfgRef.current
    const eff = effectsRef.current

    // 效果倒计时
    if (eff.wider > 0) eff.wider--
    if (eff.laser > 0) eff.laser--
    if (eff.slow > 0) eff.slow--
    if (eff.pierce > 0) {
      eff.pierce--
      if (eff.pierce === 0) {
        for (const b of ballsRef.current) b.piercing = false
      }
    }
    if (laserCdRef.current > 0) laserCdRef.current--
    if (flashRef.current > 0) flashRef.current--

    // 连击计时
    if (comboTimerRef.current > 0) {
      comboTimerRef.current--
      if (comboTimerRef.current === 0) {
        comboRef.current = 0
        setCombo(0)
      }
    }

    // 粒子更新
    const parts = particlesRef.current
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.08
      p.life--
      if (p.life <= 0) parts.splice(i, 1)
    }

    // 键盘控制挡板
    const pw = currentPaddleWidth()
    const halfPw = pw / 2
    if (keysRef.current.has('arrowleft') || keysRef.current.has('a')) {
      paddleXRef.current -= PADDLE_KEY_SPEED
    }
    if (keysRef.current.has('arrowright') || keysRef.current.has('d')) {
      paddleXRef.current += PADDLE_KEY_SPEED
    }
    paddleXRef.current = Math.max(halfPw, Math.min(W - halfPw, paddleXRef.current))

    // 道具下落 & 拾取
    const pLeft = paddleXRef.current - pw / 2
    const pRight = pLeft + pw
    const pups = powerupsRef.current
    for (let i = pups.length - 1; i >= 0; i--) {
      const p = pups[i]
      p.y += POWERUP_SPEED
      // 拾取
      if (
        p.y + POWERUP_SIZE / 2 >= PADDLE_Y &&
        p.y - POWERUP_SIZE / 2 <= PADDLE_Y + PADDLE_H &&
        p.x >= pLeft - 4 &&
        p.x <= pRight + 4
      ) {
        applyPowerUp(p.type)
        spawnParticles(p.x, p.y, POWERUP_META[p.type].color, 12, 3)
        pups.splice(i, 1)
        continue
      }
      if (p.y - POWERUP_SIZE / 2 > H) pups.splice(i, 1)
    }

    // 激光更新
    const lasers = lasersRef.current
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i]
      l.y -= LASER_SPEED
      if (l.y < -20) {
        lasers.splice(i, 1)
        continue
      }
      // 激光击中砖块
      for (const b of bricksRef.current) {
        if (!b.alive) continue
        if (
          l.x >= b.x &&
          l.x <= b.x + b.w &&
          l.y - LASER_H / 2 <= b.y + b.h &&
          l.y + LASER_H / 2 >= b.y
        ) {
          const gained = damageBrick(b)
          if (gained > 0) {
            scoreRef.current += gained
            setScore(scoreRef.current)
          }
          lasers.splice(i, 1)
          break
        }
      }
    }

    // ready 状态：球跟随挡板
    if (st === 'ready') {
      for (const ball of ballsRef.current) {
        ball.x = paddleXRef.current
        ball.y = PADDLE_Y - ball.r - 1
      }
      draw()
      rafRef.current = requestAnimationFrame(step)
      return
    }

    // 球更新
    const balls = ballsRef.current
    for (let bi = balls.length - 1; bi >= 0; bi--) {
      const ball = balls[bi]
      ball.x += ball.vx
      ball.y += ball.vy

      // 墙壁
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

      // 挡板
      if (
        ball.y + ball.r >= PADDLE_Y &&
        ball.y - ball.r <= PADDLE_Y + PADDLE_H &&
        ball.x >= pLeft - 2 &&
        ball.x <= pRight + 2 &&
        ball.vy > 0
      ) {
        const hit = (ball.x - paddleXRef.current) / (pw / 2)
        const angle = hit * (Math.PI / 3) - Math.PI / 2
        const sp = cfg.ballSpeed * (eff.slow > 0 ? 0.7 : 1)
        ball.vx = Math.cos(angle) * sp
        ball.vy = Math.sin(angle) * sp
        ball.y = PADDLE_Y - ball.r - 1
        spawnParticles(ball.x, PADDLE_Y, '#fb923c', 4, 2)
      }

      // 砖块碰撞
      for (const b of bricksRef.current) {
        if (!b.alive) continue
        if (
          ball.x + ball.r > b.x &&
          ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y &&
          ball.y - ball.r < b.y + b.h
        ) {
          const gained = damageBrick(b)
          if (gained > 0) {
            scoreRef.current += gained
            setScore(scoreRef.current)
            setCombo(comboRef.current)
          }
          if (!ball.piercing) {
            const prevX = ball.x - ball.vx
            const wasOutsideX = prevX + ball.r <= b.x || prevX - ball.r >= b.x + b.w
            if (wasOutsideX) ball.vx = -ball.vx
            else ball.vy = -ball.vy
            break // 非穿透球每帧只处理一次砖块碰撞
          }
        }
      }
    }

    // 移除落底的球
    for (let i = balls.length - 1; i >= 0; i--) {
      if (balls[i].y - balls[i].r > H) balls.splice(i, 1)
    }

    // 所有球落底 → 失去一条命
    if (balls.length === 0) {
      const left = livesRef.current - 1
      livesRef.current = left
      setLives(left)
      comboRef.current = 0
      comboTimerRef.current = 0
      setCombo(0)
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

    // 关卡完成检测（所有可破坏砖块清除）
    const remaining = bricksRef.current.some((b) => b.alive && b.type !== 'indestructible')
    if (!remaining) {
      if (levelIdxRef.current >= cfg.maxLevel) {
        const bonus = livesRef.current * 100
        const final = scoreRef.current + bonus
        scoreRef.current = final
        setScore(final)
        setStatus('won')
        statusRef.current = 'won'
        void submitEnd('win', final)
        draw()
        return
      }
      // 关卡奖励
      scoreRef.current += 200
      setScore(scoreRef.current)
      nextLevel()
      rafRef.current = requestAnimationFrame(step)
      return
    }

    draw()
    rafRef.current = requestAnimationFrame(step)
    // Game-loop helpers only read mutable refs; recreating them as callbacks would restart the RAF effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw, submitEnd])

  // ===== 启动/停止循环 =====
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

  // ===== 键盘：左右移动挡板 =====
  useEffect(() => {
    const moveKeys = new Set(['arrowleft', 'arrowright', 'a', 'd'])
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (moveKeys.has(k)) {
        e.preventDefault()
        keysRef.current.add(k)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }
    const onBlur = () => keysRef.current.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const fireLaser = () => {
    if (statusRef.current !== 'playing' || effectsRef.current.laser <= 0 || laserCdRef.current > 0)
      return
    const pw = currentPaddleWidth()
    const px = paddleXRef.current - pw / 2
    lasersRef.current.push({ x: px + 8, y: PADDLE_Y - 6 }, { x: px + pw - 8, y: PADDLE_Y - 6 })
    laserCdRef.current = LASER_COOLDOWN
  }

  // ===== 键盘：空格发射激光 =====
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (statusRef.current === 'idle' || statusRef.current === 'ready') {
          handleLaunch()
          return
        }
        fireLaser()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== 鼠标控制 =====
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const halfPw = currentPaddleWidth() / 2
    paddleXRef.current = Math.max(halfPw, Math.min(W - halfPw, x))
    if (statusRef.current === 'idle' || statusRef.current === 'ready') {
      draw()
    }
  }

  const handleLaunch = () => {
    if (statusRef.current === 'idle') {
      startTimeRef.current = Date.now()
      stickBallOnPaddle()
    }
    if (statusRef.current === 'idle' || statusRef.current === 'ready') {
      launchBall()
      setStatus('playing')
      statusRef.current = 'playing'
    }
  }

  const onCanvasClick = () => {
    handleLaunch()
  }

  const restart = () => {
    resetGame()
  }

  const pickingIdle = status === 'idle' || status === 'won' || status === 'lost'
  const totalLevels = cfgRef.current.maxLevel + 1

  return (
    <section className="game-surface breakout-room">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">BRICK BREAKER · 反弹计划</p>
          <h2>击碎边界，一路向上</h2>
        </div>
        <span className="breakout-emblem" aria-hidden="true">
          ◈
        </span>
      </header>
      <div className="gs-toolbar">
        <div className="gs-segments" aria-label="游戏难度">
          {(['简单', '中等', '复杂'] as const).map((lv) => (
            <button
              key={lv}
              disabled={!pickingIdle}
              aria-pressed={level === lv}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        <span className="gs-caption">
          {combo > 1 ? `${combo} 连击 · 保持节奏` : '找准角度，清空砖墙'}
        </span>
      </div>
      <div className="gs-metrics">
        <div>
          <span>本局得分</span>
          <strong>{String(score).padStart(4, '0')}</strong>
        </div>
        <div>
          <span>剩余生命</span>
          <strong>
            {lives}
            <small> 次</small>
          </strong>
        </div>
        <div>
          <span>当前关卡</span>
          <strong>
            {String(levelIdx + 1).padStart(2, '0')}
            <small> / {totalLevels}</small>
          </strong>
        </div>
      </div>
      <div className="breakout-frame">
        <canvas
          ref={canvasRef}
          width={W * RENDER_SCALE}
          height={H * RENDER_SCALE}
          aria-label="打砖块游戏区域，拖动挡板，点击发球"
          tabIndex={0}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || e.buttons > 0) onPointerMove(e)
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            onPointerMove(e)
            onCanvasClick()
          }}
        />
        {status === 'ready' && (
          <div className="breakout-ready" role="status">
            点击画面或按空格，再次发球
          </div>
        )}
        {(status === 'idle' || status === 'won' || status === 'lost') && (
          <div className="gs-overlay">
            <span className="gs-eyebrow">
              {status === 'idle'
                ? 'A NEW ANGLE, A NEW RECORD'
                : status === 'won'
                  ? 'STAGE CLEAR'
                  : 'GAME OVER'}
            </span>
            <div className="breakout-launch-art" aria-hidden="true">
              ●
            </div>
            <h3>
              {status === 'idle'
                ? '下一次反弹，由你掌控'
                : status === 'won'
                  ? '漂亮！全部通关'
                  : '再来一次，突破纪录'}
            </h3>
            <p>
              {status === 'idle' ? '移动鼠标或拖动画面控制挡板。' : `最终得分 ${score}`}
              <br />
              {status === 'idle' ? '接住道具，解锁更多击球方式。' : `到达第 ${levelIdx + 1} 关`}
            </p>
            <button className="gs-primary" onClick={status === 'idle' ? handleLaunch : restart}>
              {status === 'idle' ? '发球，开始挑战' : '再来一局'} ↗
            </button>
          </div>
        )}
      </div>
      <div className="breakout-controls">
        <p>
          鼠标 / 拖动 / ← → 移动挡板
          <br />
          点击画面发球 · 获得激光后按空格或按钮发射
        </p>
        <button className="gs-secondary" onClick={fireLaser} disabled={status !== 'playing'}>
          发射激光
        </button>
      </div>
      <div className="breakout-tools" aria-label="道具说明">
        {(Object.keys(POWERUP_META) as PowerUpType[]).map((t) => (
          <span key={t}>
            <i style={{ background: POWERUP_META[t].color }}>{POWERUP_META[t].label}</i>
            {POWERUP_META[t].name}
          </span>
        ))}
      </div>
    </section>
  )
}
