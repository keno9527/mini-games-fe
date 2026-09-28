import { useGamePlay } from '@/hooks/useGamePlay'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '@/api'
import { readPlayerProgress, stageProgress } from '@/api/playerFiles'
import { PencilSimple } from '@phosphor-icons/react'
import '../game-surfaces.css'
import { BRICK_COLORS, LEVEL_DETAILS, LEVEL_LAYOUTS } from './levels'
import {
  advanceBall,
  ballSpeed,
  consumeTicks,
  parseBricks,
  setBallSpeed,
  BALL_R,
  H,
  PADDLE_Y,
  W,
  type Ball,
  type Brick,
  type FrameClock,
} from './physics'
import LevelEditor from './LevelEditor'
import { breakableCount, type CustomLevel } from './editor'
import { BreakoutAudio, loadAudioSettings, saveAudioSettings, type AudioSettings } from './audio'
import './audio.css'

interface Props {
  userId?: string
  gameId: string
}

type Status = 'idle' | 'ready' | 'playing' | 'paused' | 'won' | 'lost'
type PowerUpType = 'wider' | 'multiball' | 'laser' | 'slow' | 'pierce' | 'life'

// ===== 画布常量 =====
const RENDER_SCALE = 2
const PADDLE_H = 12
const POWERUP_SIZE = 22
const POWERUP_SPEED = 2.4
const LASER_W = 3
const LASER_H = 14
const LASER_SPEED = 9
const LASER_COOLDOWN = 16 // frames
const EFFECT_FRAMES = 540 // 9s @ 60fps
const MAX_PARTICLES = 220

// ===== 游戏配置 =====
interface Cfg {
  paddle: number
  ballSpeed: number
  powerUpRate: number
}

const CONFIG: Cfg = {
  paddle: 88,
  ballSpeed: 5.6,
  powerUpRate: 0.2,
}

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

export default function Breakout(props: Props) {
  const [view, setView] = useState<'game' | 'editor' | 'test'>('game')
  const [customLevel, setCustomLevel] = useState<CustomLevel>()
  return (
    <>
      {view !== 'game' && (
        <div hidden={view !== 'editor'}>
          <LevelEditor
            active={view === 'editor'}
            onBack={() => setView('game')}
            onPlay={(level) => {
              setCustomLevel(level)
              setView('test')
            }}
          />
        </div>
      )}
      {view !== 'editor' && (
        <BreakoutPlayer
          key={view}
          {...props}
          customLevel={view === 'test' ? customLevel : undefined}
          onEditor={() => setView('editor')}
        />
      )}
    </>
  )
}

interface PlayerProps extends Props {
  customLevel?: CustomLevel
  onEditor: () => void
}

function BreakoutPlayer({ userId, gameId, customLevel, onEditor }: PlayerProps) {
  const [audioSettings, setAudioSettings] = useState(loadAudioSettings)
  const audioSettingsRef = useRef(audioSettings)
  const audioRef = useRef<BreakoutAudio | null>(null)
  audioSettingsRef.current = audioSettings
  useEffect(() => {
    const audio = new BreakoutAudio(audioSettingsRef.current)
    audioRef.current = audio
    return () => {
      audio.dispose()
      audioRef.current = null
    }
  }, [])
  const changeAudioSettings = (next: AudioSettings) => {
    setAudioSettings(next)
    saveAudioSettings(next)
    audioRef.current?.setSettings(next)
    audioRef.current?.unlock()
  }
  const [status, setStatus] = useState<Status>('idle')
  useGamePlay(
    gameId,
    customLevel
      ? 'idle'
      : status === 'playing'
        ? 'playing'
        : status === 'ready' || status === 'paused'
          ? 'paused'
          : 'idle',
  )
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [levelIdx, setLevelIdx] = useState(0)
  const [combo, setCombo] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [readyMessage, setReadyMessage] = useState('移动挡板，点击画面或按空格发球')

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
  const cfgRef = useRef<Cfg>(CONFIG)
  const rafRef = useRef<number | null>(null)
  const playTicksRef = useRef(0)
  const clockRef = useRef<FrameClock>({ lastTime: null, remainder: 0 })
  const resumeStatusRef = useRef<'playing' | 'ready'>('playing')
  const dryStreakRef = useRef(0)
  const noticeRef = useRef({ text: '', frames: 0 })
  const submittedRef = useRef(false)
  const flashRef = useRef(0) // 屏幕闪烁
  const keysRef = useRef<Set<string>>(new Set()) // 键盘按下状态
  const PADDLE_KEY_SPEED = 8

  statusRef.current = status

  // ===== 成绩提交 =====
  const submitEnd = useCallback(
    async (result: 'win' | 'lose', finalScore: number) => {
      if (customLevel || !userId || submittedRef.current) return
      submittedRef.current = true
      const dur = Math.max(1, Math.floor(playTicksRef.current / 60))
      try {
        stageProgress(gameId, userId, {
          highestUnlockedLevel: levelIdxRef.current + 1,
          lastPlayedLevel: levelIdxRef.current + 1,
        })
        await createRecord(userId, {
          gameId,
          score: finalScore,
          duration: dur,
          result,
          level: levelIdxRef.current + 1,
        })
      } catch {
        /* ignore */
      }
    },
    [userId, gameId, customLevel],
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
  const damageBrick = (b: Brick, damage = 1): number => {
    if (!b.alive) return 0
    if (b.type === 'indestructible') {
      audioRef.current?.play('steel')
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, '#94a3b8', 4, 2)
      return 0
    }
    b.hp -= damage
    if (b.hp > 0) {
      audioRef.current?.play('armor')
      spawnParticles(b.x + b.w / 2, b.y + b.h / 2, brickColor(b), 5, 2.5)
      return 5
    }
    return destroyBrick(b)
  }

  const destroyBrick = (b: Brick): number => {
    if (!b.alive) return 0
    audioRef.current?.play(
      b.type === 'explosive' ? 'explosion' : b.type === 'hard' ? 'break' : 'brick',
    )
    b.alive = false
    setRemaining(
      bricksRef.current.filter((brick) => brick.alive && brick.type !== 'indestructible').length,
    )
    const color = brickColor(b)
    spawnParticles(b.x + b.w / 2, b.y + b.h / 2, color, 10, 3.5)

    // 连击加成
    comboRef.current += 1
    comboTimerRef.current = 240
    const multiplier = 1 + Math.min(comboRef.current, 15) * 0.1
    const gained = Math.round(brickScore(b) * multiplier)

    // 道具掉落
    dryStreakRef.current++
    if (Math.random() < cfgRef.current.powerUpRate || dryStreakRef.current >= 7) {
      dryStreakRef.current = 0
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
  const resetGame = useCallback(
    (startLevel = 0) => {
      audioRef.current?.stopAll()
      const index = customLevel ? 0 : startLevel
      playTicksRef.current = 0
      clockRef.current = { lastTime: null, remainder: 0 }
      dryStreakRef.current = 0
      noticeRef.current = { text: '', frames: 0 }
      setReadyMessage('移动挡板，点击画面或按空格发球')
      bricksRef.current = parseBricks(customLevel?.layout ?? LEVEL_LAYOUTS[index])
      setRemaining(bricksRef.current.filter((b) => b.type !== 'indestructible').length)
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
      keysRef.current.clear()
      levelIdxRef.current = index
      setLevelIdx(index)
      setScore(0)
      scoreRef.current = 0
      setLives(3)
      livesRef.current = 3
      setCombo(0)
      setStatus('idle')
      statusRef.current = 'idle'
      submittedRef.current = false
      draw()
    },
    // draw reads refs and is declared below the reset callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customLevel],
  )

  useEffect(() => {
    const stored = Number(readPlayerProgress(gameId, userId).lastPlayedLevel ?? 1)
    const saved = Number.isInteger(stored) && stored > 0 ? stored : 1
    resetGame(customLevel ? 0 : Math.min(LEVEL_LAYOUTS.length - 1, Math.max(0, saved - 1)))
  }, [resetGame, gameId, userId, customLevel])

  // ===== 进入下一关 =====
  const nextLevel = () => {
    audioRef.current?.stopAll()
    audioRef.current?.play('clear')
    const next = levelIdxRef.current + 1
    levelIdxRef.current = next
    setLevelIdx(next)
    bricksRef.current = parseBricks(LEVEL_LAYOUTS[next])
    setRemaining(bricksRef.current.filter((b) => b.type !== 'indestructible').length)
    setReadyMessage('过关 +200 分 · 点击画面或按空格继续')
    dryStreakRef.current = 0
    noticeRef.current = { text: '', frames: 0 }
    particlesRef.current = []
    flashRef.current = 0
    laserCdRef.current = 0
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
    audioRef.current?.play('launch')
    const cfg = cfgRef.current
    const angle = -Math.PI / 2 + 0.25
    const sp = ballSpeed(cfg.ballSpeed, levelIdxRef.current, effectsRef.current.slow > 0)
    for (const ball of ballsRef.current) {
      ball.vx = Math.cos(angle) * sp
      ball.vy = Math.sin(angle) * sp
      ball.piercing = effectsRef.current.pierce > 0
    }
  }

  const currentPaddleWidth = () => {
    return effectsRef.current.wider > 0 ? cfgRef.current.paddle * 1.5 : cfgRef.current.paddle
  }

  // ===== 道具拾取 =====
  const applyPowerUp = (type: PowerUpType) => {
    audioRef.current?.play(type === 'life' ? 'life' : type === 'multiball' ? 'multiball' : 'pickup')
    const eff = effectsRef.current
    noticeRef.current = {
      text: `${POWERUP_META[type].name}${type === 'laser' ? ' · 自动连发' : ''}`,
      frames: 120,
    }
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
          setBallSpeed(b, ballSpeed(cfgRef.current.ballSpeed, levelIdxRef.current, true))
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

    // 发球方向预览，与固定发球角度一致。
    if (statusRef.current === 'ready') {
      ctx.save()
      ctx.setLineDash([5, 6])
      ctx.strokeStyle = '#f4e1b980'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(paddleXRef.current, PADDLE_Y - BALL_R - 1)
      ctx.lineTo(
        paddleXRef.current + Math.sin(0.25) * 100,
        PADDLE_Y - BALL_R - 1 - Math.cos(0.25) * 100,
      )
      ctx.stroke()
      ctx.restore()
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
    if (noticeRef.current.frames > 0) {
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#f4e1b9'
      ctx.fillText(noticeRef.current.text, W / 2, H - 80)
    }
  }, [])

  // ===== 固定 60Hz 更新，渲染频率与玩法速度解耦 =====
  const tick = useCallback(() => {
    const st = statusRef.current
    if (st !== 'playing' && st !== 'ready') return
    const cfg = cfgRef.current
    const eff = effectsRef.current

    const halfPw = currentPaddleWidth() / 2
    if (keysRef.current.has('arrowleft') || keysRef.current.has('a')) {
      paddleXRef.current -= PADDLE_KEY_SPEED
    }
    if (keysRef.current.has('arrowright') || keysRef.current.has('d')) {
      paddleXRef.current += PADDLE_KEY_SPEED
    }
    paddleXRef.current = Math.max(halfPw, Math.min(W - halfPw, paddleXRef.current))

    // 等待发球时冻结道具、连击和计时，球跟随挡板。
    if (st === 'ready') {
      for (const ball of ballsRef.current) {
        ball.x = paddleXRef.current
        ball.y = PADDLE_Y - ball.r - 1
      }
      return
    }

    playTicksRef.current++
    if (eff.wider > 0) eff.wider--
    if (eff.laser > 0) eff.laser--
    if (eff.slow > 0) eff.slow--
    if (eff.pierce > 0) eff.pierce--
    if (laserCdRef.current > 0) laserCdRef.current--
    if (flashRef.current > 0) flashRef.current--
    if (noticeRef.current.frames > 0) noticeRef.current.frames--
    if (comboTimerRef.current > 0 && --comboTimerRef.current === 0) {
      comboRef.current = 0
      setCombo(0)
    }

    const parts = particlesRef.current
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.08
      if (--p.life <= 0) parts.splice(i, 1)
    }

    const pw = currentPaddleWidth()
    const pLeft = paddleXRef.current - pw / 2
    const pRight = pLeft + pw
    const pups = powerupsRef.current
    for (let i = pups.length - 1; i >= 0; i--) {
      const p = pups[i]
      p.y += POWERUP_SPEED
      if (
        p.y + POWERUP_SIZE / 2 >= PADDLE_Y &&
        p.y - POWERUP_SIZE / 2 <= PADDLE_Y + PADDLE_H &&
        p.x + POWERUP_SIZE / 2 >= pLeft &&
        p.x - POWERUP_SIZE / 2 <= pRight
      ) {
        applyPowerUp(p.type)
        spawnParticles(p.x, p.y, POWERUP_META[p.type].color, 12, 3)
        pups.splice(i, 1)
      } else if (p.y - POWERUP_SIZE / 2 > H) {
        pups.splice(i, 1)
      }
    }

    // 激光拾取后自动连发，让键盘、鼠标和触屏玩家都能专注接球。
    fireLaser()
    const addScore = (gained: number) => {
      if (gained <= 0) return
      scoreRef.current += gained
      setScore(scoreRef.current)
      setCombo(comboRef.current)
    }
    const lasers = lasersRef.current
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i]
      l.y -= LASER_SPEED
      if (l.y < -20) {
        lasers.splice(i, 1)
        continue
      }
      // 从下往上检查，先命中离挡板最近的砖块。
      for (let j = bricksRef.current.length - 1; j >= 0; j--) {
        const b = bricksRef.current[j]
        if (!b.alive) continue
        if (
          l.x + LASER_W / 2 >= b.x &&
          l.x - LASER_W / 2 <= b.x + b.w &&
          l.y - LASER_H / 2 <= b.y + b.h &&
          l.y + LASER_H / 2 >= b.y
        ) {
          addScore(damageBrick(b))
          lasers.splice(i, 1)
          break
        }
      }
    }

    const balls = ballsRef.current
    const speed = ballSpeed(cfg.ballSpeed, levelIdxRef.current, eff.slow > 0)
    for (const ball of balls) {
      ball.piercing = eff.pierce > 0
      const bounced = advanceBall(
        ball,
        bricksRef.current,
        paddleXRef.current,
        currentPaddleWidth(),
        speed,
        (brick) => addScore(damageBrick(brick, ball.piercing ? brick.hp : 1)),
        () => audioRef.current?.play('wall'),
      )
      if (bounced) {
        audioRef.current?.play('paddle')
        spawnParticles(ball.x, PADDLE_Y, '#fb923c', 4, 2)
      }
    }
    for (let i = balls.length - 1; i >= 0; i--) {
      if (balls[i].y - balls[i].r > H) balls.splice(i, 1)
    }

    // 同一帧击碎最后一块砖并落球时，优先判定通关。
    if (!bricksRef.current.some((b) => b.alive && b.type !== 'indestructible')) {
      if (customLevel || levelIdxRef.current === LEVEL_LAYOUTS.length - 1) {
        audioRef.current?.stopAll()
        audioRef.current?.play(customLevel ? 'clear' : 'victory')
        scoreRef.current += livesRef.current * 100
        setScore(scoreRef.current)
        statusRef.current = 'won'
        setStatus('won')
        void submitEnd('win', scoreRef.current)
      } else {
        scoreRef.current += 200
        setScore(scoreRef.current)
        nextLevel()
      }
      return
    }

    if (balls.length === 0) {
      audioRef.current?.stopAll()
      livesRef.current--
      setLives(livesRef.current)
      comboRef.current = 0
      comboTimerRef.current = 0
      setCombo(0)
      if (livesRef.current <= 0) {
        audioRef.current?.play('gameover')
        statusRef.current = 'lost'
        setStatus('lost')
        void submitEnd('lose', scoreRef.current)
        return
      }
      // 丢球后清场，避免待发球阶段仍有激光击砖或掉落道具。
      audioRef.current?.play('lost')
      effectsRef.current = { wider: 0, laser: 0, slow: 0, pierce: 0 }
      lasersRef.current = []
      powerupsRef.current = []
      laserCdRef.current = 0
      noticeRef.current = { text: '', frames: 0 }
      setReadyMessage('稳住，还有机会 · 点击画面或按空格发球')
      statusRef.current = 'ready'
      setStatus('ready')
      stickBallOnPaddle()
    }
    // Helpers read mutable game refs; keep the simulation stable across HUD updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitEnd, customLevel])

  const step = useCallback(
    (time: number) => {
      rafRef.current = null
      const before = statusRef.current
      if (before !== 'playing' && before !== 'ready') return
      const ticks = consumeTicks(clockRef.current, time)
      for (let i = 0; i < ticks; i++) {
        tick()
        if (statusRef.current !== before) break
      }
      draw()
      if (statusRef.current === 'playing' || statusRef.current === 'ready') {
        rafRef.current = requestAnimationFrame(step)
      }
    },
    [draw, tick],
  )

  useEffect(() => {
    clockRef.current = { lastTime: null, remainder: 0 }
    if (status === 'playing' || status === 'ready') {
      rafRef.current = requestAnimationFrame(step)
    }
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [status, step])

  const pause = useCallback((silent = false) => {
    const current = statusRef.current
    keysRef.current.clear()
    audioRef.current?.stopAll()
    if (current !== 'playing' && current !== 'ready') return
    if (!silent) audioRef.current?.play('pause')
    resumeStatusRef.current = current
    statusRef.current = 'paused'
    setStatus('paused')
  }, [])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    audioRef.current?.unlock()
    audioRef.current?.play('resume')
    statusRef.current = resumeStatusRef.current
    setStatus(resumeStatusRef.current)
    canvasRef.current?.focus({ preventScroll: true })
  }, [])

  const fireLaser = () => {
    if (statusRef.current !== 'playing' || effectsRef.current.laser <= 0 || laserCdRef.current > 0)
      return
    const pw = currentPaddleWidth()
    const px = paddleXRef.current - pw / 2
    lasersRef.current.push({ x: px + 8, y: PADDLE_Y - 6 }, { x: px + pw - 8, y: PADDLE_Y - 6 })
    audioRef.current?.play('laser')
    laserCdRef.current = LASER_COOLDOWN
  }

  // ===== 键盘和离开窗口保护 =====
  useEffect(() => {
    const moveKeys = new Set(['arrowleft', 'arrowright', 'a', 'd'])
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      const key = e.key.toLowerCase()
      if (key === 'p' || key === 'escape') {
        e.preventDefault()
        if (e.repeat) return
        if (statusRef.current === 'paused') resume()
        else pause()
        return
      }
      // Leave native button/link activation intact.
      if (target?.closest('button, a')) return
      if (moveKeys.has(key) && (statusRef.current === 'playing' || statusRef.current === 'ready')) {
        e.preventDefault()
        keysRef.current.add(key)
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (e.repeat) return
        if (statusRef.current === 'paused') resume()
        else handleLaunch()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase())
    const onVisibility = () => {
      if (document.hidden) pause(true)
    }
    const onBlur = () => pause(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // handleLaunch only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause, resume])

  // ===== 鼠标控制 =====
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== 'playing' && statusRef.current !== 'ready') return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const halfPw = currentPaddleWidth() / 2
    paddleXRef.current = Math.max(halfPw, Math.min(W - halfPw, x))
    if (statusRef.current === 'ready') {
      for (const ball of ballsRef.current) ball.x = paddleXRef.current
      draw()
    }
  }

  const handleLaunch = () => {
    audioRef.current?.unlock()
    if (statusRef.current === 'idle') {
      stickBallOnPaddle()
      statusRef.current = 'ready'
      setStatus('ready')
      canvasRef.current?.focus({ preventScroll: true })
      return
    }
    if (statusRef.current === 'ready') {
      launchBall()
      setStatus('playing')
      statusRef.current = 'playing'
      canvasRef.current?.focus({ preventScroll: true })
    }
  }

  const onCanvasClick = () => {
    handleLaunch()
  }

  const restart = () => {
    resetGame(levelIdxRef.current)
  }

  const pickingIdle = status === 'idle' || status === 'won' || status === 'lost'
  const totalLevels = customLevel ? 1 : LEVEL_LAYOUTS.length
  const stage = customLevel
    ? { name: customLevel.name, hint: '试玩不会改变原稿；返回编辑可继续调整砖块。' }
    : LEVEL_DETAILS[levelIdx]
  const brickCount = breakableCount(customLevel?.layout ?? LEVEL_LAYOUTS[levelIdx])

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
      <div className="breakout-layout">
        <aside className="breakout-sidebar" aria-label="关卡与游戏状态">
          <div className="breakout-settings">
            {customLevel ? (
              <div className="breakout-custom-banner">
                <p>试玩 · {customLevel.name} · 不计入排行榜</p>
                <button className="gs-secondary" onClick={onEditor}>
                  <PencilSimple size={18} aria-hidden="true" />
                  返回编辑
                </button>
              </div>
            ) : (
              <>
                <label className="breakout-level-select">
                  <span>选择关卡</span>
                  <select
                    aria-label="选择关卡"
                    value={levelIdx}
                    disabled={!pickingIdle}
                    onChange={(event) => resetGame(Number(event.target.value))}
                  >
                    {LEVEL_DETAILS.map((stage, index) => (
                      <option key={index} value={index}>
                        第 {index + 1} 关 · {stage.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="gs-secondary" disabled={!pickingIdle} onClick={onEditor}>
                  <PencilSimple size={18} aria-hidden="true" />
                  关卡编辑
                </button>
              </>
            )}
          </div>
          <div className="breakout-audio" role="group" aria-label="音效设置">
            <button
              className="gs-secondary"
              aria-pressed={audioSettings.enabled}
              onClick={() =>
                changeAudioSettings({ ...audioSettings, enabled: !audioSettings.enabled })
              }
            >
              音效：{audioSettings.enabled ? '开' : '关'}
            </button>
            <label>
              音量
              <input
                type="range"
                aria-label="音效音量"
                min="0"
                max="100"
                step="5"
                value={Math.round(audioSettings.volume * 100)}
                onChange={(event) =>
                  changeAudioSettings({
                    ...audioSettings,
                    volume: Number(event.target.value) / 100,
                  })
                }
              />
              <output>{Math.round(audioSettings.volume * 100)}%</output>
            </label>
          </div>
          <dl className="breakout-stats">
            <div className="breakout-score">
              <dt>本局得分</dt>
              <dd>{String(score).padStart(4, '0')}</dd>
            </div>
            <div>
              <dt>剩余生命</dt>
              <dd>
                {lives}
                <small> 次</small>
              </dd>
            </div>
            <div>
              <dt>当前关卡</dt>
              <dd>
                {String(levelIdx + 1).padStart(2, '0')}
                <small> / {totalLevels}</small>
              </dd>
            </div>
          </dl>
          <div className="breakout-stage" aria-label="关卡进度">
            <span>
              剩余 {remaining} / {brickCount} 块
            </span>
            <progress value={brickCount - remaining} max={brickCount} aria-label="砖块清除进度" />
            <p>{stage.hint}</p>
            {combo > 1 && (
              <p className="breakout-combo">
                {combo} 连击 · ×{(1 + Math.min(combo, 15) * 0.1).toFixed(1)} 得分
              </p>
            )}
          </div>
        </aside>
        <div className="breakout-playfield">
          <div className="breakout-frame">
            <canvas
              ref={canvasRef}
              width={W * RENDER_SCALE}
              height={H * RENDER_SCALE}
              aria-label="打砖块游戏区域，鼠标、拖动或方向键移动挡板，点击或空格发球，P 键暂停"
              tabIndex={0}
              onPointerMove={(e) => {
                if (e.pointerType === 'mouse' || e.buttons > 0) onPointerMove(e)
              }}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.currentTarget.setPointerCapture(e.pointerId)
                e.currentTarget.focus({ preventScroll: true })
                onPointerMove(e)
                onCanvasClick()
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  e.currentTarget.releasePointerCapture(e.pointerId)
              }}
            />
            {status === 'ready' && (
              <div className="breakout-ready" role="status">
                {readyMessage}
              </div>
            )}
            {status === 'paused' && (
              <div className="gs-overlay">
                <span className="gs-eyebrow">TAKE A BREATH</span>
                <h3>休息一下，手感还在</h3>
                <p>
                  球和道具已暂停。
                  <br />
                  准备好后继续这次挑战。
                </p>
                <button className="gs-primary" onClick={resume}>
                  继续游戏 ↗
                </button>
                <button className="gs-secondary" onClick={restart}>
                  重新开始
                </button>
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
                      ? customLevel
                        ? '漂亮！试玩通关'
                        : '漂亮！全部通关'
                      : '再来一次，拿下这一关'}
                </h3>
                <p>
                  {status === 'idle' ? '移动鼠标或拖动画面控制挡板。' : `最终得分 ${score}`}
                  <br />
                  {status === 'idle'
                    ? customLevel
                      ? '接住道具，验证你的砖墙设计。'
                      : `${totalLevels} 关递进挑战，激光拾取后自动连发。`
                    : customLevel
                      ? customLevel.name
                      : `到达第 ${levelIdx + 1} 关`}
                </p>
                <button className="gs-primary" onClick={status === 'idle' ? handleLaunch : restart}>
                  {status === 'idle'
                    ? '开始挑战'
                    : customLevel
                      ? '重新试玩'
                      : `重试第 ${levelIdx + 1} 关`}{' '}
                  ↗
                </button>
              </div>
            )}
          </div>
          <div className="breakout-controls">
            <p>
              鼠标 / 拖动 / ← → / A D 移动挡板
              <br />
              点击或空格发球 · P / Esc 暂停 · 激光自动连发
            </p>
            <div className="breakout-actions">
              {status === 'ready' && (
                <button className="gs-primary" onClick={handleLaunch}>
                  发球
                </button>
              )}
              <button
                className="gs-secondary"
                onClick={status === 'paused' ? resume : () => pause()}
                disabled={status !== 'playing' && status !== 'ready' && status !== 'paused'}
              >
                {status === 'paused' ? '继续' : '暂停'}
              </button>
            </div>
          </div>
          <div className="breakout-tools" aria-label="道具说明">
            {(Object.keys(POWERUP_META) as PowerUpType[]).map((t) => (
              <span key={t}>
                <i style={{ background: POWERUP_META[t].color }}>{POWERUP_META[t].label}</i>
                {POWERUP_META[t].name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
