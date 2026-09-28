import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceBall,
  ballSpeed,
  consumeTicks,
  parseBricks,
  setBallSpeed,
  BALL_R,
  PADDLE_Y,
  W,
  type Ball,
  type Brick,
  type FrameClock,
} from '../src/games/breakout/physics.ts'
import { LEVEL_DETAILS, LEVEL_LAYOUTS } from '../src/games/breakout/levels.ts'

const ballAt = (props: Partial<Ball> = {}): Ball => ({
  x: 220,
  y: 260,
  vx: 1,
  vy: -6,
  r: BALL_R,
  piercing: false,
  ...props,
})
const brickAt = (props: Partial<Brick> = {}): Brick => ({
  x: 200,
  y: 200,
  w: 40,
  h: 20,
  row: 0,
  col: 0,
  type: 'normal',
  hp: 1,
  maxHp: 1,
  alive: true,
  ...props,
})
const approx = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)

test('30, 60, 120 and 144 Hz deliver identical movement and 9-second effect duration', () => {
  for (const hz of [30, 60, 120, 144]) {
    const clock: FrameClock = { lastTime: null, remainder: 0 }
    let effect = 540
    let paddleX = 0
    for (let frame = 0; frame <= hz * 9; frame++) {
      const ticks = consumeTicks(clock, (frame * 1000) / hz)
      effect -= ticks
      paddleX += ticks * 8
    }
    assert.equal(effect, 0, `${hz} Hz`)
    assert.equal(paddleX, 4320, `${hz} Hz`)
  }
})

test('stalled frames are bounded and a resumed clock does not catch up paused time', () => {
  const clock: FrameClock = { lastTime: null, remainder: 0 }
  assert.equal(consumeTicks(clock, 0), 0)
  assert.equal(consumeTicks(clock, 60000), 6)
  clock.lastTime = null
  clock.remainder = 0
  assert.equal(consumeTicks(clock, 120000), 0)
  assert.equal(consumeTicks(clock, 120000 + 1000 / 60), 1)
})

test('slow pickups refresh at 70% without compounding and expiry restores full speed immediately', () => {
  const ball = ballAt()
  const slow = ballSpeed(7, 5, true)
  for (let i = 0; i < 4; i++) {
    setBallSpeed(ball, slow)
    approx(Math.hypot(ball.vx, ball.vy), 6.125)
  }
  advanceBall(ball, [], W / 2, 66, ballSpeed(7, 5, false), () => {})
  approx(Math.hypot(ball.vx, ball.vy), 8.75)
})

test('near-horizontal and vertical trajectories regain useful angles while preserving direction', () => {
  for (const velocity of [
    { vx: -8, vy: -0.001 },
    { vx: 0.001, vy: 8 },
  ]) {
    const ball = ballAt(velocity)
    setBallSpeed(ball, 8)
    assert.ok(Math.abs(ball.vx) >= 8 * Math.sin(0.12) - 1e-6)
    assert.ok(Math.abs(ball.vy) >= 2.4 - 1e-6)
    assert.equal(Math.sign(ball.vx), Math.sign(velocity.vx))
    assert.equal(Math.sign(ball.vy), Math.sign(velocity.vy))
    approx(Math.hypot(ball.vx, ball.vy), 8)
  }
})

test('fast balls hit a thin brick once and leave the surface rather than tunnelling or vibrating', () => {
  const brick = brickAt({ type: 'hard', hp: 2, maxHp: 2 })
  const ball = ballAt({ y: 235 })
  let hits = 0
  const onHit = () => {
    brick.hp--
    hits++
  }
  advanceBall(ball, [brick], 240, 88, 35, onHit)
  assert.equal(hits, 1)
  assert.equal(brick.hp, 1)
  assert.ok(ball.vy > 0)
  assert.ok(ball.y - ball.r >= brick.y + brick.h)
  advanceBall(ball, [brick], 240, 88, 35, onHit)
  assert.equal(hits, 1)
})

test('side impacts reflect horizontally and corner near-misses do not hit the rectangle bounds', () => {
  const brick = brickAt()
  const ball = ballAt({ x: 247, y: 210, vx: -7, vy: 2.5 })
  let hits = 0
  advanceBall(ball, [brick], 240, 88, 7, () => hits++)
  assert.equal(hits, 1)
  assert.ok(ball.vx > 0)
  const miss = ballAt({ x: 194, y: 194, vx: -1, vy: -1 })
  advanceBall(miss, [brick], 240, 88, 1, () => hits++)
  assert.equal(hits, 1)
})

test('piercing balls continue through ordinary bricks but reflect off indestructible steel', () => {
  for (const type of ['normal', 'indestructible'] as const) {
    const brick = brickAt({ type })
    const ball = ballAt({ y: 230, piercing: true })
    let hits = 0
    advanceBall(ball, [brick], 240, 88, 30, () => {
      hits++
      if (type === 'normal') brick.alive = false
    })
    assert.equal(hits, 1)
    assert.equal(ball.vy > 0, type === 'indestructible')
    assert.equal(brick.alive, type === 'indestructible')
  }
})

test('paddle contact position controls left, middle and right rebounds even at high speeds', () => {
  for (const offset of [-40, 0, 40]) {
    const ball = ballAt({ x: 240 + offset, y: PADDLE_Y - BALL_R - 10, vx: 0, vy: 30 })
    const hit = advanceBall(ball, [], 240, 88, 30, () => {})
    assert.equal(hit, true)
    assert.ok(ball.vy < 0)
    if (offset) assert.equal(Math.sign(ball.vx), Math.sign(offset))
    approx(Math.hypot(ball.vx, ball.vy), 30)
    assert.ok(ball.y + ball.r < PADDLE_Y)
  }
})

test('grazing the paddle edge is catchable but moving it under an already-fallen ball cannot rescue it', () => {
  const edge = ballAt({ x: 287, y: PADDLE_Y - BALL_R - 1, vx: -1, vy: 6 })
  assert.equal(
    advanceBall(edge, [], 240, 88, 6, () => {}),
    true,
  )
  const fallen = ballAt({ x: 240, y: PADDLE_Y + 3, vx: 1, vy: 6 })
  assert.equal(
    advanceBall(fallen, [], 240, 88, 6, () => {}),
    false,
  )
  assert.ok(fallen.vy > 0)
})

test('wall recovery always sends the ball inward without losing speed', () => {
  const ball = ballAt({ x: 4, y: 4, vx: -5, vy: -5 })
  advanceBall(ball, [], 240, 88, 7, () => {})
  assert.ok(ball.x >= BALL_R && ball.y >= BALL_R)
  assert.ok(ball.vx > 0 && ball.vy > 0)
  approx(Math.hypot(ball.vx, ball.vy), 7)
})

test('thirty named layouts have valid geometry and no destructible cells enclosed by steel', () => {
  assert.equal(LEVEL_LAYOUTS.length, 30)
  assert.equal(LEVEL_DETAILS.length, LEVEL_LAYOUTS.length)
  assert.equal(new Set(LEVEL_DETAILS.map((level) => level.name)).size, 30)
  assert.equal(new Set(LEVEL_LAYOUTS.map((rows) => rows.join('').replace(/[1-9]/g, '1'))).size, 30)
  LEVEL_LAYOUTS.forEach((layout, index) => {
    assert.ok(LEVEL_DETAILS[index].name && LEVEL_DETAILS[index].hint)
    assert.ok(layout.every((row) => row.length === 12 && /^[.1-9HX#]+$/.test(row)))
    const bricks = parseBricks(layout)
    assert.ok(bricks.some((brick) => brick.type !== 'indestructible'))
    assert.ok(
      bricks.every(
        (brick) => brick.x >= 0 && brick.x + brick.w <= W && brick.y + brick.h < PADDLE_Y,
      ),
    )
    const visited = new Set<string>()
    const queue = Array.from({ length: 12 }, (_, col) => [layout.length, col])
    for (let i = 0; i < queue.length; i++) {
      const [row, col] = queue[i]
      const key = `${row},${col}`
      if (
        row < 0 ||
        row > layout.length ||
        col < 0 ||
        col >= 12 ||
        layout[row]?.[col] === '#' ||
        visited.has(key)
      )
        continue
      visited.add(key)
      queue.push([row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1])
    }
    for (const brick of bricks) {
      if (brick.type !== 'indestructible')
        assert.ok(visited.has(`${brick.row},${brick.col}`), `level ${index + 1}: unreachable brick`)
    }
  })
})

for (const config of [
  { name: 'easy', width: 110, speed: 4.5 },
  { name: 'normal', width: 88, speed: 5.6 },
  { name: 'hard', width: 66, speed: 7 },
]) {
  test(`${config.name}: all 30 stages can be cleared through paddle rallies without power-ups`, () => {
    for (const [stage, layout] of LEVEL_LAYOUTS.entries()) {
      const bricks = parseBricks(layout)
      const ball = ballAt({ x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 2, vy: -5 })
      let seed = stage + 1
      let offset = 0
      const remaining = () => bricks.some((brick) => brick.alive && brick.type !== 'indestructible')
      // A reproducible paddle controller varies the bounce angle after each catch.
      // No explosion or power-up assistance: all targets must be physically reachable.
      for (let tick = 0; tick < 60 * 240 && remaining(); tick++) {
        const paddleX = Math.max(config.width / 2, Math.min(W - config.width / 2, ball.x + offset))
        const hit = advanceBall(
          ball,
          bricks,
          paddleX,
          config.width,
          ballSpeed(config.speed, stage, false),
          (brick) => {
            if (brick.type !== 'indestructible' && --brick.hp <= 0) brick.alive = false
          },
        )
        if (hit) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
          offset = (seed / 2 ** 32 - 0.5) * (config.width * 0.74)
        }
        assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y))
        assert.ok(ball.y < 520, `stage ${stage + 1}: paddle catch failed`)
      }
      assert.equal(remaining(), false, `stage ${stage + 1}: unreachable bricks or stuck trajectory`)
    }
  })
}

test('late stages retain the speed cap rather than accelerating for all 30 levels', () => {
  approx(ballSpeed(7, 0, false), 7)
  approx(ballSpeed(7, 5, false), 8.75)
  approx(ballSpeed(7, 29, false), 8.75)
  approx(ballSpeed(7, 29, true), 6.125)
})
