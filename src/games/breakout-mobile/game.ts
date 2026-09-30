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
} from '../breakout/physics'
import { BRICK_COLORS, LEVEL_LAYOUTS } from '../breakout/levels'
import { LevelSettlement } from '../breakout/settlement'
import type { BreakoutSound } from '../breakout/audio'

export type Status = 'ready' | 'playing' | 'paused' | 'won' | 'lost'
export type PowerUpType = 'wider' | 'multiball' | 'laser' | 'slow' | 'pierce' | 'life'

// ===== 画布常量 =====
export const PADDLE_H = 12
export const POWERUP_SIZE = 22
const POWERUP_SPEED = 2.4
export const LASER_W = 3
export const LASER_H = 14
const LASER_SPEED = 9
const LASER_COOLDOWN = 16 // frames
export const EFFECT_FRAMES = 540 // 9s @ 60fps
const MAX_PARTICLES = 220

// ===== 游戏配置 =====
interface Cfg {
  paddle: number
  ballSpeed: number
  powerUpRate: number
}

export const CONFIG: Cfg = {
  paddle: 88,
  ballSpeed: 5.6,
  powerUpRate: 0.2,
}

export const POWERUP_META: Record<
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
export function brickColor(b: Brick): string {
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

export interface GameSnapshot {
  status: Status
  level: number
  score: number
  lives: number
  remaining: number
  combo: number
  message: string
  challengeStarted: boolean
}

/** Mobile-only simulation; no DOM, file API or browser storage dependencies. */
export class MobileGame {
  status: Status = 'ready'
  level = 0
  score = 0
  lives = 3
  paddleX = W / 2
  balls: Ball[] = []
  bricks: Brick[] = []
  powerups: PowerUp[] = []
  lasers: Laser[] = []
  particles: Particle[] = []
  effects: Effects = { wider: 0, laser: 0, slow: 0, pierce: 0 }
  notice = { text: '', frames: 0 }
  flash = 0
  combo = 0
  message = '先左右滑动，再点发球'
  challengeStarted = false
  onSound: (sound: BreakoutSound) => void = () => {}
  onStopSounds: () => void = () => {}
  onSettlement: (lastPlayedLevel: number, score: number) => void = () => {}
  private resumeStatus: 'ready' | 'playing' = 'ready'
  private clock: FrameClock = { lastTime: null, remainder: 0 }
  private settlement = new LevelSettlement()
  private playTicks = 0
  private comboTimer = 0
  private laserCd = 0
  private dryStreak = 0

  constructor(
    level = 0,
    private random: () => number = Math.random,
  ) {
    this.reset(level)
  }

  get paddleWidth() {
    return CONFIG.paddle * (this.effects.wider > 0 ? 1.5 : 1)
  }
  get remaining() {
    return this.bricks.filter((b) => b.alive && b.type !== 'indestructible').length
  }

  snapshot(): GameSnapshot {
    return {
      status: this.status,
      level: this.level,
      score: this.score,
      lives: this.lives,
      remaining: this.remaining,
      combo: this.combo,
      message: this.message,
      challengeStarted: this.challengeStarted,
    }
  }

  reset(level = this.level) {
    this.onStopSounds()
    this.level = Math.max(0, Math.min(LEVEL_LAYOUTS.length - 1, Math.trunc(level)))
    this.score = 0
    this.lives = 3
    this.challengeStarted = false
    this.playTicks = 0
    this.paddleX = W / 2
    this.loadStage()
    this.message = '先左右滑动，再点发球'
  }

  private loadStage() {
    this.bricks = parseBricks(LEVEL_LAYOUTS[this.level])
    this.particles = []
    this.flash = 0
    this.dryStreak = 0
    this.clearEffects()
    this.clock = { lastTime: null, remainder: 0 }
    this.settlement.begin(this.level, this.score, this.playTicks)
    this.status = 'ready'
    this.stickBall()
  }

  private clearEffects() {
    this.effects = { wider: 0, laser: 0, slow: 0, pierce: 0 }
    this.lasers = []
    this.powerups = []
    this.laserCd = 0
    this.combo = 0
    this.comboTimer = 0
    this.notice = { text: '', frames: 0 }
  }

  private stickBall() {
    this.balls = [
      { x: this.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, r: BALL_R, piercing: false },
    ]
  }

  moveTo(x: number) {
    if (this.status !== 'ready' && this.status !== 'playing') return
    this.paddleX = Math.max(this.paddleWidth / 2, Math.min(W - this.paddleWidth / 2, x))
    if (this.status === 'ready') this.stickBall()
  }

  launch() {
    if (this.status !== 'ready') return
    this.challengeStarted = true
    const speed = ballSpeed(CONFIG.ballSpeed, this.level, false)
    for (const ball of this.balls) {
      ball.vx = Math.sin(0.25) * speed
      ball.vy = -Math.cos(0.25) * speed
    }
    this.status = 'playing'
    this.clock = { lastTime: null, remainder: 0 }
    this.onSound('launch')
  }

  pause(silent = false) {
    this.onStopSounds()
    if (this.status !== 'playing' && this.status !== 'ready') return
    this.resumeStatus = this.status
    this.status = 'paused'
    this.clock = { lastTime: null, remainder: 0 }
    if (!silent) this.onSound('pause')
  }

  resume() {
    if (this.status !== 'paused') return
    this.status = this.resumeStatus
    this.clock = { lastTime: null, remainder: 0 }
    this.onSound('resume')
  }

  frame(time: number) {
    if (this.status !== 'playing') return
    const ticks = consumeTicks(this.clock, time)
    for (let i = 0; i < ticks && this.status === 'playing'; i++) this.tick()
  }

  private particlesAt(x: number, y: number, color: string, count: number, speed = 3) {
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i++) {
      const a = this.random() * Math.PI * 2
      const s = this.random() * speed + 1
      const life = 20 + this.random() * 25
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life,
        maxLife: life,
        color,
        size: 2 + this.random() * 3,
      })
    }
  }

  private damageBrick(b: Brick, damage = 1): number {
    if (!b.alive) return 0
    if (b.type === 'indestructible') {
      this.onSound('steel')
      this.particlesAt(b.x + b.w / 2, b.y + b.h / 2, '#94a3b8', 4, 2)
      return 0
    }
    b.hp -= damage
    if (b.hp > 0) {
      this.onSound('armor')
      this.particlesAt(b.x + b.w / 2, b.y + b.h / 2, brickColor(b), 5, 2.5)
      return 5
    }
    b.alive = false
    this.onSound(b.type === 'explosive' ? 'explosion' : b.type === 'hard' ? 'break' : 'brick')
    this.particlesAt(b.x + b.w / 2, b.y + b.h / 2, brickColor(b), 10, 3.5)
    this.combo++
    this.comboTimer = 240
    let gained = Math.round(brickScore(b) * (1 + Math.min(this.combo, 15) * 0.1))
    this.dryStreak++
    if (this.random() < CONFIG.powerUpRate || this.dryStreak >= 7) {
      this.dryStreak = 0
      const type = this.random() < 0.06 ? 'life' : POWERUP_TYPES[Math.floor(this.random() * 5)]
      this.powerups.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, type })
    }
    if (b.type === 'explosive') {
      this.flash = 8
      this.particlesAt(b.x + b.w / 2, b.y + b.h / 2, '#fbbf24', 18, 5)
      for (const other of this.bricks) {
        if (other.alive && Math.abs(other.row - b.row) <= 1 && Math.abs(other.col - b.col) <= 1)
          gained += this.damageBrick(other)
      }
    }
    return gained
  }

  private pickup(type: PowerUpType) {
    this.onSound(type === 'life' ? 'life' : type === 'multiball' ? 'multiball' : 'pickup')
    this.notice = {
      text: `${POWERUP_META[type].name}${type === 'laser' ? ' · 自动连发' : ''}`,
      frames: 120,
    }
    if (type === 'life') this.lives = Math.min(this.lives + 1, 9)
    else if (type === 'multiball') {
      const balls: Ball[] = []
      for (const b of this.balls) {
        if (!b.vx && !b.vy) continue
        const speed = Math.hypot(b.vx, b.vy)
        const angle = Math.atan2(b.vy, b.vx)
        for (const offset of [-0.35, 0, 0.35])
          balls.push({
            ...b,
            vx: Math.cos(angle + offset) * speed,
            vy: Math.sin(angle + offset) * speed,
          })
      }
      if (balls.length) this.balls = balls.slice(0, 12)
    } else {
      this.effects[type] = EFFECT_FRAMES
      if (type === 'slow')
        for (const b of this.balls) setBallSpeed(b, ballSpeed(CONFIG.ballSpeed, this.level, true))
      if (type === 'pierce') for (const b of this.balls) b.piercing = true
      this.moveTo(this.paddleX)
    }
  }

  private finish(result: 'win' | 'lose') {
    const settled = this.settlement.finish(result, this.score, this.playTicks, LEVEL_LAYOUTS.length)
    if (settled) this.onSettlement(settled.progress.lastPlayedLevel, this.score)
  }

  tick() {
    if (this.status !== 'playing') return
    this.playTicks++
    for (const key of ['wider', 'laser', 'slow', 'pierce'] as const)
      if (this.effects[key] > 0) this.effects[key]--
    if (this.laserCd > 0) this.laserCd--
    if (this.flash > 0) this.flash--
    if (this.notice.frames > 0) this.notice.frames--
    if (this.comboTimer > 0 && --this.comboTimer === 0) this.combo = 0
    for (const p of this.particles) {
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.08
      p.life--
    }
    this.particles = this.particles.filter((p) => p.life > 0)

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i]
      p.y += POWERUP_SPEED
      if (
        p.y + POWERUP_SIZE / 2 >= PADDLE_Y &&
        p.y - POWERUP_SIZE / 2 <= PADDLE_Y + PADDLE_H &&
        Math.abs(p.x - this.paddleX) <= (this.paddleWidth + POWERUP_SIZE) / 2
      ) {
        this.pickup(p.type)
        this.particlesAt(p.x, p.y, POWERUP_META[p.type].color, 12)
        this.powerups.splice(i, 1)
      } else if (p.y - POWERUP_SIZE / 2 > H) this.powerups.splice(i, 1)
    }
    if (this.effects.laser > 0 && this.laserCd === 0) {
      const left = this.paddleX - this.paddleWidth / 2
      this.lasers.push(
        { x: left + 8, y: PADDLE_Y - 6 },
        { x: left + this.paddleWidth - 8, y: PADDLE_Y - 6 },
      )
      this.laserCd = LASER_COOLDOWN
      this.onSound('laser')
    }
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const laser = this.lasers[i]
      laser.y -= LASER_SPEED
      if (laser.y < -20) {
        this.lasers.splice(i, 1)
        continue
      }
      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const b = this.bricks[j]
        if (
          b.alive &&
          laser.x + LASER_W / 2 >= b.x &&
          laser.x - LASER_W / 2 <= b.x + b.w &&
          laser.y - LASER_H / 2 <= b.y + b.h &&
          laser.y + LASER_H / 2 >= b.y
        ) {
          this.score += this.damageBrick(b)
          this.lasers.splice(i, 1)
          break
        }
      }
    }
    const speed = ballSpeed(CONFIG.ballSpeed, this.level, this.effects.slow > 0)
    for (const b of this.balls) {
      b.piercing = this.effects.pierce > 0
      const bounced = advanceBall(
        b,
        this.bricks,
        this.paddleX,
        this.paddleWidth,
        speed,
        (brick) => {
          this.score += this.damageBrick(brick, b.piercing ? brick.hp : 1)
        },
        () => this.onSound('wall'),
      )
      if (bounced) {
        this.onSound('paddle')
        this.particlesAt(b.x, PADDLE_Y, '#fb923c', 4, 2)
      }
    }
    this.balls = this.balls.filter((b) => b.y - b.r <= H)
    // Win takes precedence over a last-ball loss in the same frame.
    if (this.remaining === 0) {
      this.onStopSounds()
      if (this.level === LEVEL_LAYOUTS.length - 1) {
        this.score += this.lives * 100
        this.status = 'won'
        this.onSound('victory')
        this.finish('win')
      } else {
        this.score += 200
        this.finish('win')
        this.level++
        this.loadStage()
        this.message = '过关 +200 分 · 准备好再发球'
        this.onSound('clear')
      }
      return
    }
    if (this.balls.length === 0) {
      this.onStopSounds()
      this.lives--
      this.clearEffects()
      if (this.lives === 0) {
        this.status = 'lost'
        this.onSound('gameover')
        this.finish('lose')
      } else {
        this.status = 'ready'
        this.message = '稳住，还有机会 · 点发球继续'
        this.stickBall()
        this.onSound('lost')
      }
    }
  }
}
