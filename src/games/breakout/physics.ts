export const W = 480
export const H = 520
export const PADDLE_Y = H - 32
export const BALL_R = 6
const BRICK_H = 20
const BRICK_TOP = 52
const TICK_MS = 1000 / 60

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  piercing: boolean
}

export interface Brick {
  x: number
  y: number
  w: number
  h: number
  row: number
  col: number
  type: 'normal' | 'hard' | 'explosive' | 'indestructible'
  hp: number
  maxHp: number
  alive: boolean
}

export interface FrameClock {
  lastTime: number | null
  remainder: number
}

// Keep gameplay at 60 ticks/s on both low- and high-refresh displays. Cap catch-up
// after a stalled frame; pause/resume starts with a fresh clock.
export function consumeTicks(clock: FrameClock, now: number): number {
  if (clock.lastTime === null) {
    clock.lastTime = now
    return 0
  }
  clock.remainder += Math.max(0, Math.min(100, now - clock.lastTime))
  clock.lastTime = now
  const ticks = Math.floor((clock.remainder + 1e-7) / TICK_MS)
  clock.remainder = Math.max(0, clock.remainder - ticks * TICK_MS)
  return ticks
}

export function ballSpeed(base: number, stage: number, slowed: boolean): number {
  return base * (1 + Math.min(stage, 5) * 0.05) * (slowed ? 0.7 : 1)
}

// Normalize from the configured speed, never the previous slow-effect velocity.
// A minimum slope also prevents endless near-horizontal or vertical rallies.
export function setBallSpeed(ball: Ball, speed: number) {
  const angle = Math.atan2(Math.abs(ball.vx), Math.abs(ball.vy))
  const bounded = Math.max(0.12, Math.min(Math.acos(0.3), angle))
  ball.vx = (ball.vx < 0 ? -1 : 1) * Math.sin(bounded) * speed
  ball.vy = (ball.vy > 0 ? 1 : -1) * Math.cos(bounded) * speed
}

function resolveBrick(ball: Ball, brick: Brick, reflect: boolean): boolean {
  const cx = Math.max(brick.x, Math.min(brick.x + brick.w, ball.x))
  const cy = Math.max(brick.y, Math.min(brick.y + brick.h, ball.y))
  const dx = ball.x - cx
  const dy = ball.y - cy
  const distance = Math.hypot(dx, dy)
  if (distance >= ball.r) return false
  if (!reflect) return true

  let nx: number
  let ny: number
  let overlap: number
  if (distance > 0) {
    nx = dx / distance
    ny = dy / distance
    overlap = ball.r - distance
  } else {
    // Recover safely even if a new ball starts inside a brick.
    const faces = [
      { depth: ball.x - brick.x, nx: -1, ny: 0 },
      { depth: brick.x + brick.w - ball.x, nx: 1, ny: 0 },
      { depth: ball.y - brick.y, nx: 0, ny: -1 },
      { depth: brick.y + brick.h - ball.y, nx: 0, ny: 1 },
    ]
    const face = faces.reduce((closest, candidate) =>
      candidate.depth < closest.depth ? candidate : closest,
    )
    nx = face.nx
    ny = face.ny
    overlap = face.depth + ball.r
  }
  ball.x += nx * (overlap + 0.01)
  ball.y += ny * (overlap + 0.01)
  const towards = ball.vx * nx + ball.vy * ny
  if (towards < 0) {
    ball.vx -= 2 * towards * nx
    ball.vy -= 2 * towards * ny
  }
  return true
}

export function advanceBall(
  ball: Ball,
  bricks: Brick[],
  paddleX: number,
  paddleWidth: number,
  speed: number,
  onHit: (brick: Brick) => void,
): boolean {
  setBallSpeed(ball, speed)
  const steps = Math.max(1, Math.ceil(speed / (ball.r / 2)))
  const hitBricks = new Set<Brick>()
  let paddleHit = false
  for (let i = 0; i < steps; i++) {
    const previousX = ball.x
    const previousY = ball.y
    ball.x += ball.vx / steps
    ball.y += ball.vy / steps

    if (ball.x < ball.r) {
      ball.x = ball.r
      ball.vx = Math.abs(ball.vx)
    } else if (ball.x > W - ball.r) {
      ball.x = W - ball.r
      ball.vx = -Math.abs(ball.vx)
    }
    if (ball.y < ball.r) {
      ball.y = ball.r
      ball.vy = Math.abs(ball.vy)
    }

    if (ball.vy > 0 && previousY + ball.r <= PADDLE_Y && ball.y + ball.r >= PADDLE_Y) {
      const fraction = (PADDLE_Y - ball.r - previousY) / (ball.y - previousY)
      const contactX = previousX + (ball.x - previousX) * fraction
      if (Math.abs(contactX - paddleX) <= paddleWidth / 2 + ball.r) {
        const hit = Math.max(-1, Math.min(1, (contactX - paddleX) / (paddleWidth / 2)))
        const angle = hit * (Math.PI / 3)
        const incomingX = ball.vx
        ball.vx = Math.sin(angle) * speed
        if (Math.abs(hit) < 0.01) ball.vx = Math.sign(incomingX) * speed * 0.12
        ball.vy = -Math.cos(angle) * speed
        setBallSpeed(ball, speed)
        ball.y = PADDLE_Y - ball.r - 0.01
        paddleHit = true
      }
    }

    for (const brick of bricks) {
      if (!brick.alive || hitBricks.has(brick)) continue
      // Steel always reflects, including a piercing ball.
      const reflect = !ball.piercing || brick.type === 'indestructible'
      if (!resolveBrick(ball, brick, reflect)) continue
      hitBricks.add(brick)
      onHit(brick)
      if (reflect) {
        setBallSpeed(ball, speed)
        break
      }
    }
  }
  return paddleHit
}

export function parseBricks(layout: string[]): Brick[] {
  const cols = layout[0].length
  const bw = W / cols
  const bricks: Brick[] = []
  for (let r = 0; r < layout.length; r++) {
    const row = layout[r]
    for (let c = 0; c < cols; c++) {
      const ch = row[c]
      if (ch === '.' || ch === ' ') continue
      let type: Brick['type'] = 'normal'
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
