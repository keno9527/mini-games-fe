import { W, H, PADDLE_Y, BALL_R } from '../breakout/physics'
import {
  type MobileGame,
  type PowerUpType,
  POWERUP_META,
  POWERUP_SIZE,
  PADDLE_H,
  LASER_W,
  LASER_H,
  EFFECT_FRAMES,
  brickColor,
} from './game'

export function drawGame(canvas: HTMLCanvasElement, game: MobileGame) {
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.width || !canvas.height) return
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0)
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
  for (const b of game.bricks) {
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
  for (const p of game.powerups) {
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
  for (const l of game.lasers) {
    ctx.fillRect(l.x - LASER_W / 2, l.y - LASER_H / 2, LASER_W, LASER_H)
    ctx.fillStyle = '#fee2e2'
    ctx.fillRect(l.x - 1, l.y - LASER_H / 2, 2, LASER_H)
    ctx.fillStyle = '#fca5a5'
  }

  // 挡板
  const pw = game.paddleWidth
  const px = game.paddleX - pw / 2
  const hasLaser = game.effects.laser > 0
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
  if (game.status === 'ready') {
    ctx.save()
    ctx.setLineDash([5, 6])
    ctx.strokeStyle = '#f4e1b980'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(game.paddleX, PADDLE_Y - BALL_R - 1)
    ctx.lineTo(game.paddleX + Math.sin(0.25) * 100, PADDLE_Y - BALL_R - 1 - Math.cos(0.25) * 100)
    ctx.stroke()
    ctx.restore()
  }

  // 球
  for (const ball of game.balls) {
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
  for (const p of game.particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
  }
  ctx.globalAlpha = 1

  // 屏幕闪烁（爆炸）
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,220,100,${game.flash / 20})`
    ctx.fillRect(0, 0, W, H)
  }

  // 顶部效果指示器
  const eff = game.effects
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
  if (game.notice.frames > 0) {
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f4e1b9'
    ctx.fillText(game.notice.text, W / 2, H - 80)
  }
}
