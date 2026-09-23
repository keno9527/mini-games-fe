import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { updateSpawning } from '../src/games/tank-battle/system/SpawnManager.ts'
import {
  updatePowerUps,
  updatePowerUpTimers,
  dropPowerUp,
} from '../src/games/tank-battle/system/PowerUpSystem.ts'
import { Explosion } from '../src/games/tank-battle/entity/Explosion.ts'
import {
  PLAYER_TANK_SPRITES,
  PLAYER_TREAD_SPRITES,
  ENEMY_TANK_SPRITES,
  ENEMY_TREAD_SPRITES,
} from '../src/games/tank-battle/data/sprites.ts'
import { PowerUp } from '../src/games/tank-battle/entity/PowerUp.ts'
import { SceneManager } from '../src/games/tank-battle/scene/SceneManager.ts'
import { LEVELS } from '../src/games/tank-battle/data/levels.ts'
import { Tank } from '../src/games/tank-battle/entity/Tank.ts'
import { World } from '../src/games/tank-battle/system/World.ts'
import { TerrainGrid } from '../src/games/tank-battle/system/TerrainGrid.ts'
import { canMoveTank, tryMoveTank } from '../src/games/tank-battle/system/MovementSystem.ts'
import { updatePlayer } from '../src/games/tank-battle/system/PlayerController.ts'
import { updateEnemyAi } from '../src/games/tank-battle/system/EnemyAiSystem.ts'
import { fireBullet, updateBullets } from '../src/games/tank-battle/system/BulletSystem.ts'
import {
  drawTank,
  drawTerrainCell,
  drawTreeCell,
  drawPowerUp,
  drawExplosion,
} from '../src/games/tank-battle/render/drawSprites.ts'
import { drawHud } from '../src/games/tank-battle/render/Hud.ts'
import { renderBattlefield } from '../src/games/tank-battle/render/renderBattlefield.ts'
import { BattleScene } from '../src/games/tank-battle/scene/BattleScene.ts'
import { AudioEngine } from '../src/games/tank-battle/core/AudioEngine.ts'
import { PixelCanvas } from '../src/games/tank-battle/render/PixelCanvas.ts'
import {
  TerrainKind,
  PowerUpKind,
  SceneKind,
  SoundEffect,
  Direction,
  EnemyKind,
  TankSide,
  type InputSnapshot,
} from '../src/games/tank-battle/types.ts'
import {
  FREEZE_TICKS,
  SHOVEL_TICKS,
  HELMET_SHIELD_TICKS,
  LEVEL_CLEAR_TICKS,
  LEVEL_INTRO_TICKS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FIELD_PIXELS,
  FIELD_OFFSET_X,
  FIELD_OFFSET_Y,
} from '../src/games/tank-battle/constants.ts'

const idle: InputSnapshot = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  pauseEdge: false,
  confirmEdge: false,
}
const emptyMap = () => Array.from({ length: 13 }, () => '.'.repeat(13))
function tank(x: number, y: number, kind: EnemyKind | null = null): Tank {
  return new Tank({
    x,
    y,
    side: kind === null ? TankSide.PLAYER : TankSide.ENEMY,
    direction: Direction.UP,
    enemyKind: kind,
  })
}
function canvasRecorder() {
  const rectangles: {
    x: number
    y: number
    width: number
    height: number
    color: string | CanvasGradient | CanvasPattern
  }[] = []
  let offsetX = 0
  let offsetY = 0
  const stack: [number, number][] = []
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect(x: number, y: number, width: number, height: number) {
      rectangles.push({ x: x + offsetX, y: y + offsetY, width, height, color: this.fillStyle })
    },
    strokeRect() {},
    beginPath() {},
    rect() {},
    clip() {},
    save() {
      stack.push([offsetX, offsetY])
    },
    restore() {
      ;[offsetX, offsetY] = stack.pop()!
    },
    translate(x: number, y: number) {
      offsetX += x
      offsetY += y
    },
  } as unknown as CanvasRenderingContext2D
  return { context, rectangles }
}

test('blocked turns preserve position across repeated frames and probes do not mutate tanks', () => {
  const player = tank(32, 44)
  const blocker = tank(48, 63, EnemyKind.BASIC)
  const context = { terrain: new TerrainGrid(emptyMap()), otherTanks: [blocker], baseRect: null }
  const before = JSON.stringify(player)
  assert.equal(canMoveTank(player, Direction.RIGHT, context), false)
  assert.equal(JSON.stringify(player), before)
  for (let frame = 0; frame < 4; frame += 1) {
    assert.equal(tryMoveTank(player, Direction.RIGHT, context), false)
    assert.deepEqual([player.x, player.y], [32, 44])
    assert.equal(player.direction, Direction.RIGHT)
  }
  blocker.alive = false
  assert.equal(tryMoveTank(player, Direction.RIGHT, context), true)
  assert.deepEqual([player.x, player.y], [33, 48])
})

test('movement rejects terrain and base collisions without applying the turn snap', () => {
  const rows = emptyMap()
  rows[4] = '..@..........'
  const player = tank(32, 44)
  const context = {
    terrain: new TerrainGrid(rows),
    otherTanks: [],
    baseRect: { x: 48, y: 48, width: 16, height: 16 },
  }
  assert.equal(tryMoveTank(player, Direction.RIGHT, context), false)
  assert.deepEqual([player.x, player.y], [32, 44])
  player.y = 48
  assert.equal(tryMoveTank(player, Direction.DOWN, context), false)
  assert.deepEqual([player.x, player.y], [32, 48])
})

test('active input takes over residual ice momentum without double movement', () => {
  const world = new World(1)
  world.terrain.load(emptyMap())
  world.players[0].tank = tank(32, 32)
  world.players[0].tank.slideTicks = 8
  world.players[0].tank.slideDirection = Direction.LEFT
  updatePlayer(world, { ...idle, right: true }, () => {})
  assert.equal(world.players[0].tank.x, 33)
  assert.equal(world.players[0].tank.direction, Direction.RIGHT)
  assert.equal(world.players[0].tank.slideTicks, 0)
})

test('releasing input on ice slides once per frame and stops at a wall', () => {
  const rows = emptyMap()
  rows[2] = '..%@.........'
  const world = new World(1)
  world.terrain.load(rows)
  world.players[0].tank = tank(31, 32)
  updatePlayer(world, { ...idle, right: true }, () => {})
  assert.equal(world.players[0].tank.x, 32)
  assert.equal(world.players[0].tank.slideTicks, 12)
  updatePlayer(world, idle, () => {})
  assert.equal(world.players[0].tank.x, 32)
  assert.equal(world.players[0].tank.slideTicks, 0)
  assert.equal(world.players[0].tank.moving, false)
})

test('enemy decisions use the only traversable direction, including tank obstacles', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const rows = emptyMap()
    rows[1] = '..@..........'
    rows[2] = '.@...........'
    const world = new World(seed)
    world.terrain.load(rows)
    const enemy = tank(32, 32, EnemyKind.BASIC)
    enemy.aiDecisionTicks = 40 // A blocked path must trigger a decision before the timer expires.
    world.enemies = [enemy]
    world.players[0].tank = tank(48, 32)
    updateEnemyAi(world)
    assert.equal(enemy.direction, Direction.DOWN)
    assert.deepEqual([enemy.x, enemy.y], [32, 33])
  }
})

test('steel blocks aiming bonuses while brick walls can still be targeted', () => {
  for (const [obstacle, expected] of [
    ['@', 0.006],
    ['#', 0.018],
    ['.', 0.018],
  ] as const) {
    const world = new World(1)
    const rows = emptyMap()
    rows[4] = `..${obstacle}..........`
    world.terrain.load(rows)
    world.base.destroy()
    const enemy = tank(32, 16, EnemyKind.BASIC)
    enemy.direction = Direction.DOWN
    enemy.aiDecisionTicks = 40
    world.enemies = [enemy]
    world.players[0].tank = tank(32, 112)
    let probability = 0
    world.rng.chance = (chance) => {
      probability = chance
      return false
    }
    updateEnemyAi(world)
    assert.ok(Math.abs(probability - expected) < 1e-10)
  }
})

test('all 35 original maps and ordered waves match the disassembly data', () => {
  assert.equal(LEVELS.length, 35)
  for (const level of LEVELS) {
    assert.equal(level.terrain.length, 13)
    assert.ok(level.terrain.every((row) => row.length === 13 && /^[.>#v<^rblt@~*%]+$/.test(row)))
    assert.equal(level.enemyQueue.length, 20)
  }
  // SHA256 of the decoded 35 stage_XX.bin maps, with rows joined by LF.
  assert.equal(
    createHash('sha256')
      .update(LEVELS.flatMap((level) => level.terrain).join('\n'))
      .digest('hex'),
    'd45dbc58c2123ce6fd10a70c0718b7623af970878c5e4df5b8eeea153db6780d',
  )
  assert.deepEqual(LEVELS[0].enemyQueue, [
    ...Array(18).fill(EnemyKind.BASIC),
    ...Array(2).fill(EnemyKind.FAST),
  ])
  assert.deepEqual(LEVELS[1].enemyQueue.slice(0, 6), [
    EnemyKind.ARMOR,
    EnemyKind.ARMOR,
    ...Array(4).fill(EnemyKind.FAST),
  ])
  assert.deepEqual(LEVELS[34].enemyQueue, [
    ...Array(4).fill(EnemyKind.POWER),
    ...Array(6).fill(EnemyKind.FAST),
    ...Array(10).fill(EnemyKind.ARMOR),
  ])
})

test('actual shots and armor hits trigger feedback that expires on logical ticks', () => {
  const world = new World(1)
  world.terrain.load(emptyMap())
  const player = tank(32, 64)
  const enemy = tank(32, 40, EnemyKind.ARMOR)
  world.players[0].tank = player
  world.enemies = [enemy]
  assert.equal(fireBullet(world, player), true)
  assert.equal(player.muzzleFlashTicks, 5)
  player.tickTimers()
  assert.equal(fireBullet(world, player), false)
  assert.equal(player.muzzleFlashTicks, 4)
  for (let frame = 0; frame < 4; frame += 1) updateBullets(world, () => {})
  assert.equal(enemy.armor, 3)
  assert.equal(enemy.hitFlashTicks, 8)
  for (let frame = 0; frame < 8; frame += 1) {
    player.tickTimers()
    enemy.tickTimers()
  }
  assert.equal(player.muzzleFlashTicks, 0)
  assert.equal(enemy.hitFlashTicks, 0)
  enemy.shieldTicks = 20
  enemy.takeHit()
  assert.equal(enemy.armor, 3)
  assert.equal(enemy.hitFlashTicks, 0)
})

test('tread rendering changes with movement, and rendering leaves state and RNG untouched', () => {
  const world = new World(55)
  world.players[0].tank = tank(32, 32)
  const first = canvasRecorder()
  drawTank(first.context, world.players[0].tank)
  world.players[0].tank.moving = true
  world.players[0].tank.tickTimers()
  world.players[0].tank.tickTimers()
  const second = canvasRecorder()
  drawTank(second.context, world.players[0].tank)
  assert.notDeepEqual(second.rectangles, first.rectangles)
  const before = JSON.stringify(world)
  const frame = canvasRecorder()
  renderBattlefield(frame.context, world, 3)
  const firstFrame = frame.rectangles.slice()
  renderBattlefield(frame.context, world, 3)
  assert.deepEqual(frame.rectangles.slice(firstFrame.length), firstFrame)
  assert.ok(
    firstFrame.some(
      (rect) =>
        rect.x === FIELD_OFFSET_X &&
        rect.y === FIELD_OFFSET_Y &&
        rect.width === FIELD_PIXELS &&
        rect.height === FIELD_PIXELS &&
        rect.color === '#000000',
    ),
  )
  assert.equal(JSON.stringify(world), before)
})

test('pause freezes combat feedback and timed effects until play resumes', () => {
  const world = new World(1)
  const scene = new BattleScene(world, silentAudio(), { onGameOver() {} })
  scene.onEnter()
  for (let frame = 0; frame < LEVEL_INTRO_TICKS; frame += 1) scene.update(idle)
  world.players[0].tank!.muzzleFlashTicks = 5
  world.freezeTicks = 60
  world.shovelTicks = 120
  scene.update({ ...idle, pauseEdge: true })
  const before = JSON.stringify(world)
  for (let frame = 0; frame < 120; frame += 1) scene.update(idle)
  assert.equal(JSON.stringify(world), before)
  scene.update({ ...idle, pauseEdge: true })
  scene.update(idle)
  assert.equal(world.players[0].tank!.muzzleFlashTicks, 4)
  assert.equal(world.freezeTicks, 59)
  assert.equal(world.shovelTicks, 119)
})

test('HUD counters and simultaneous effects fit the frame without covering the battlefield', () => {
  const world = new World(1)
  world.loadLevel(0)
  world.freezeTicks = 600
  world.shovelTicks = 900
  world.players[0].tank!.shieldTicks = 600
  world.players[0].tank!.star = 3
  const { context, rectangles } = canvasRecorder()
  drawHud(context, world)
  for (const rect of rectangles) {
    assert.ok(rect.x >= 0 && rect.x + rect.width <= CANVAS_WIDTH, JSON.stringify(rect))
    assert.ok(rect.y >= 0 && rect.y + rect.height <= CANVAS_HEIGHT, JSON.stringify(rect))
    assert.ok(
      rect.x >= FIELD_OFFSET_X + FIELD_PIXELS || rect.y >= FIELD_OFFSET_Y + FIELD_PIXELS,
      JSON.stringify(rect),
    )
  }
})

function silentAudio(): AudioEngine {
  return { play() {}, playSequence() {}, setMotor() {}, stopAll() {} } as unknown as AudioEngine
}

test('half brick and half steel have matching collision and render masks', () => {
  const rows = emptyMap()
  rows[2] = '..>v<^rblt...'
  const terrain = new TerrainGrid(rows)
  const masks = [0xcccc, 0xff00, 0x3333, 0x00ff]
  for (let index = 0; index < 8; index += 1) {
    const x = index + 2
    assert.equal(terrain.getWallMask(x, 2), masks[index % 4])
    for (let sy = 0; sy < 4; sy += 1) {
      for (let sx = 0; sx < 4; sx += 1) {
        assert.equal(
          terrain.blocksTank({ x: x * 16 + sx * 4, y: 32 + sy * 4, width: 4, height: 4 }),
          Boolean(masks[index % 4] & (1 << (sy * 4 + sx))),
        )
      }
    }
  }
  assert.equal(terrain.isSteelAt(96, 32), false)
  assert.equal(terrain.isSteelAt(104, 32), true)
})

test('brick shots open tank-width passages and upgraded shots break only hit steel quadrants', () => {
  const rows = emptyMap()
  rows[2] = '..#@.........'
  const terrain = new TerrainGrid(rows)
  for (const y of [44, 40, 36, 32]) {
    assert.equal(
      terrain.hitByBullet({ x: 38, y, width: 4, height: 4 }, 1, Direction.UP).destroyed,
      true,
    )
  }
  assert.equal(terrain.blocksTank({ x: 32, y: 32, width: 16, height: 16 }), false)
  assert.deepEqual(terrain.hitByBullet({ x: 54, y: 44, width: 4, height: 4 }, 1), {
    hit: true,
    destroyed: false,
  })
  assert.equal(terrain.hitByBullet({ x: 54, y: 44, width: 4, height: 4 }, 2).destroyed, true)
  assert.equal(terrain.getWallMask(3, 2), 0xff)
  assert.equal(terrain.blocksTank({ x: 48, y: 40, width: 16, height: 8 }), false)
})

test('base walls form an 8px U and shovel rebuilds damaged walls on repeated pickups', () => {
  const terrain = new TerrainGrid(emptyMap())
  assert.equal(terrain.blocksTank({ x: 88, y: 176, width: 8, height: 8 }), false)
  assert.equal(terrain.blocksTank({ x: 88, y: 184, width: 8, height: 8 }), true)
  terrain.applyShovel()
  terrain.hitByBullet({ x: 90, y: 185, width: 4, height: 4 }, 2)
  terrain.applyShovel()
  assert.equal(terrain.getKind(5, 11), TerrainKind.STEEL)
  assert.equal(terrain.getWallMask(5, 11), 0xcc00)
  terrain.revertShovel()
  assert.equal(terrain.getKind(5, 11), TerrainKind.BRICK)
  assert.equal(terrain.getWallMask(5, 11), 0xcc00)
})

test('exactly the 4th, 11th and 18th enemies carry bonuses in every stage', () => {
  for (let stage = 0; stage < LEVELS.length; stage += 1) {
    const world = new World(7)
    world.loadLevel(stage)
    const carriers = []
    for (let ordinal = 1; ordinal <= 20; ordinal += 1) {
      world.enemies = []
      world.spawnCountdownTicks = 0
      updateSpawning(world)
      const enemy = world.enemies[0]
      assert.ok(enemy, `stage ${stage + 1}, enemy ${ordinal}`)
      assert.equal(world.terrain.blocksTank(enemy.getRect()), false)
      if (enemy.bonusCarrier) carriers.push(ordinal)
    }
    assert.deepEqual(carriers, [4, 11, 18])
  }
})

test('a bonus armor tank drops on first hit only; ordinary kills never drop randomly', () => {
  for (const carrier of [true, false]) {
    const world = new World(1)
    world.terrain.load(emptyMap())
    const player = tank(32, 64)
    const enemy = tank(32, 40, EnemyKind.ARMOR)
    enemy.bonusCarrier = carrier
    world.players[0].tank = player
    world.enemies = [enemy]
    const sounds: SoundEffect[] = []
    for (let hit = 0; hit < 4; hit += 1) {
      player.fireCooldownTicks = 0
      fireBullet(world, player)
      for (let frame = 0; frame < 4; frame += 1)
        updateBullets(world, (effect) => sounds.push(effect))
      assert.equal(world.powerUps.length, carrier ? 1 : 0)
    }
    assert.equal(
      sounds.filter((sound) => sound === SoundEffect.BONUS_APPEAR).length,
      carrier ? 1 : 0,
    )
    assert.equal(world.score, 400)
    assert.equal(world.stageKills.armor, 1)
  }
})

test('six powerups apply their effects, award 500 points, and expire on game ticks', () => {
  for (const kind of Object.values(PowerUpKind)) {
    const world = new World(3)
    world.loadLevel(0)
    world.enemies = [tank(0, 0, EnemyKind.BASIC), tank(16, 0, EnemyKind.ARMOR)]
    world.powerUps = [new PowerUp(kind, 4, 12)]
    updatePowerUps(world, () => {})
    assert.equal(world.score, 500)
    assert.equal(world.powerUps[0].alive, false)
    if (kind === PowerUpKind.STAR) assert.equal(world.players[0].tank?.star, 1)
    if (kind === PowerUpKind.TANK) assert.equal(world.players[0].lives, 7)
    if (kind === PowerUpKind.HELMET)
      assert.equal(world.players[0].tank?.shieldTicks, HELMET_SHIELD_TICKS)
    if (kind === PowerUpKind.TIMER) assert.equal(world.freezeTicks, FREEZE_TICKS)
    if (kind === PowerUpKind.GRENADE) {
      assert.equal(world.enemiesKilled, 2)
      assert.equal(world.stageKills.basic + world.stageKills.armor, 0)
    }
    if (kind === PowerUpKind.SHOVEL) {
      assert.equal(world.shovelTicks, SHOVEL_TICKS)
      for (let i = 0; i < SHOVEL_TICKS; i += 1) updatePowerUpTimers(world)
      assert.equal(world.terrain.getKind(6, 11), TerrainKind.BRICK)
    }
  }
})

test('rewards never vanish because randomized placement failed on a dense map', () => {
  const world = new World(1)
  world.terrain.load(Array.from({ length: 13 }, () => '@'.repeat(13)))
  world.terrain.clearSpawnCell(4, 12)
  world.rng.nextInt = () => 0
  dropPowerUp(world)
  assert.equal(world.powerUps.length, 1)
  assert.deepEqual([world.powerUps[0].cellX, world.powerUps[0].cellY], [4, 12])
})

test('star upgrades persist between stages but reset on death; 20000 awards one extra life', () => {
  const world = new World(1)
  world.loadLevel(0)
  for (let i = 0; i < 5; i += 1) world.players[0].tank!.upgrade()
  assert.equal(world.players[0].tank?.star, 3)
  world.loadLevel(1)
  assert.equal(world.players[0].tank?.star, 3)
  world.addScore(20000)
  assert.equal(world.players[0].lives, 7)
  world.addScore(20000)
  assert.equal(world.players[0].lives, 7)
  world.onPlayerDestroyed()
  for (let i = 0; i < 30; i += 1) updateSpawning(world)
  assert.equal(world.players[0].tank?.star, 0)
})

test('all 35 stages can initialize, render and simulate with valid coordinates', () => {
  for (let stage = 0; stage < LEVELS.length; stage += 1) {
    const world = new World(stage + 1)
    world.levelIndex = stage
    const scene = new BattleScene(world, silentAudio(), { onGameOver() {} })
    scene.onEnter()
    for (let frame = 0; frame < LEVEL_INTRO_TICKS + 600; frame += 1)
      scene.update({ ...idle, fire: true })
    renderBattlefield(canvasRecorder().context, world, 2)
    for (const entity of [
      ...world.enemies,
      ...(world.players[0].tank ? [world.players[0].tank] : []),
    ]) {
      assert.ok(Number.isFinite(entity.x) && entity.x >= 0 && entity.x <= 192)
      assert.ok(Number.isFinite(entity.y) && entity.y >= 0 && entity.y <= 192)
    }
  }
})

test('campaign transitions through all 35 stages, keeps upgrades, and reports victory once', () => {
  const world = new World(1)
  let victories = 0
  const scene = new BattleScene(world, silentAudio(), {
    onGameOver: (won) => {
      if (won) victories += 1
    },
  })
  scene.onEnter()
  world.players[0].tank!.star = 2
  for (let stage = 0; stage < 35; stage += 1) {
    assert.equal(world.levelIndex, stage)
    assert.equal(world.players[0].tank?.star, 2)
    for (let frame = 0; frame < LEVEL_INTRO_TICKS; frame += 1) scene.update(idle)
    world.pendingEnemies = []
    world.enemies = []
    scene.update(idle)
    for (let frame = 0; frame < LEVEL_CLEAR_TICKS; frame += 1) scene.update(idle)
  }
  assert.equal(victories, 1)
})

test('pausing during introduction preserves phase and timers', () => {
  const world = new World(1)
  const scene = new BattleScene(world, silentAudio(), { onGameOver() {} })
  scene.onEnter()
  scene.update({ ...idle, pauseEdge: true })
  for (let frame = 0; frame < 200; frame += 1) scene.update(idle)
  assert.equal(scene.isPaused(), true)
  scene.update({ ...idle, pauseEdge: true })
  scene.update(idle)
  assert.equal(world.enemies.length, 0)
})

test('practice clears only the selected stage; title return preserves mode', () => {
  const world = new World(1)
  world.levelIndex = 14
  let completed = false
  const scene = new BattleScene(world, silentAudio(), {
    practice: true,
    onGameOver: (won) => {
      completed = won
    },
  })
  scene.onEnter()
  for (let frame = 0; frame < LEVEL_INTRO_TICKS; frame += 1) scene.update(idle)
  world.pendingEnemies = []
  world.enemies = []
  scene.update(idle)
  for (let frame = 0; frame < LEVEL_CLEAR_TICKS; frame += 1) scene.update(idle)
  assert.equal(completed, true)
  assert.equal(world.levelIndex, 14)

  const manager = new SceneManager(silentAudio(), 1)
  manager.setPracticeStage(34)
  manager.update({ ...idle, confirmEdge: true })
  assert.equal(manager.getCurrentKind(), SceneKind.BATTLE)
  manager.returnToTitle()
  assert.equal(manager.getCurrentKind(), SceneKind.BATTLE)
  manager.update({ ...idle, pauseEdge: true })
  manager.returnToTitle()
  assert.equal(manager.getCurrentKind(), SceneKind.TITLE)
})

test('sample audio switches one engine loop, sequences music and cancels pending playback', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousFetch = globalThis.fetch
  const sources: { startTime: number; stopped: boolean; disconnected: boolean; loop: boolean }[] =
    []
  let closed = false
  let release!: () => void
  const loaded = new Promise<void>((resolve) => {
    release = resolve
  })
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
  const node = () => ({ connect() {}, disconnect() {} })
  class FakeAudioContext {
    state = 'running'
    currentTime = 1
    destination = node()
    createGain() {
      return { ...node(), gain: { value: 0 } }
    }
    async decodeAudioData() {
      await loaded
      return {
        duration: 4,
        length: 4000,
        sampleRate: 1000,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(4000).fill(0.5, 1000, 3000),
      }
    }
    createBuffer(channels: number, length: number, sampleRate: number) {
      return { duration: length / sampleRate, copyToChannel() {} }
    }
    createBufferSource() {
      const source = {
        ...node(),
        startTime: 0,
        stopped: false,
        disconnected: false,
        loop: false,
        buffer: null,
        onended: null,
        start(time: number) {
          this.startTime = time
        },
        stop() {
          this.stopped = true
        },
        disconnect() {
          this.disconnected = true
        },
      }
      sources.push(source)
      return source
    }
    close() {
      closed = true
      return Promise.resolve()
    }
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: FakeAudioContext },
  })
  const requested: string[] = []
  globalThis.fetch = (async (url: string) => {
    requested.push(url)
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(1) }
  }) as typeof fetch
  const audio = new AudioEngine()
  try {
    audio.unlock()
    audio.play(SoundEffect.FIRE)
    audio.setMotor(SoundEffect.IDLE)
    audio.stopAll()
    release()
    await flush()
    assert.equal(sources.length, 0, 'late decoding must not resurrect a stopped scene')
    assert.equal(requested.length, 18)
    audio.setMotor(SoundEffect.IDLE)
    await flush()
    audio.setMotor(SoundEffect.IDLE)
    await flush()
    assert.equal(sources.length, 1, 'same engine state must not stack loops')
    assert.equal(sources[0].loop, true)
    audio.setMotor(SoundEffect.MOTOR)
    await flush()
    assert.equal(sources[0].stopped, true)
    assert.equal(sources.length, 2)
    audio.playSequence([SoundEffect.GAME_OVER, SoundEffect.HIGH_SCORE])
    await flush()
    assert.ok(
      Math.abs(sources[3].startTime - sources[2].startTime - 2.006) < 0.0001,
      'music sequencing excludes silent padding',
    )
    audio.setEnabled(false)
    assert.ok(sources.every((source) => source.stopped && source.disconnected))
    audio.play(SoundEffect.FIRE)
    audio.setMotor(SoundEffect.MOTOR)
    await flush()
    assert.equal(sources.length, 4)
    audio.setEnabled(true)
    audio.setMotor(SoundEffect.IDLE)
    await flush()
    assert.equal(sources.length, 5)
    audio.dispose()
    assert.equal(closed, true)
    assert.ok(sources.every((source) => source.stopped && source.disconnected))
  } finally {
    audio.dispose()
    globalThis.fetch = previousFetch
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('battle canvas fits viewport and controls, grows after shrinking, and restores title sizing', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const listeners = new Map<string, () => void>()
  const properties = new Map<string, string>()
  const viewport = { clientWidth: 1440, clientHeight: 900 }
  const toolbar = { offsetHeight: 50 }
  const controls = { offsetHeight: 0 }
  let sideWidth = '0'
  const shell = {
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
    querySelectorAll: () => [toolbar, controls],
  }
  const stage = {
    clientWidth: 1200,
    parentElement: shell,
    getBoundingClientRect: () => ({ top: 260 }),
  }
  const context = { imageSmoothingEnabled: true }
  const canvas = {
    width: 0,
    height: 0,
    style: { width: '', height: '' },
    getContext: () => context,
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: 1440,
      innerHeight: 900,
      addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name),
      getComputedStyle: (element: unknown) => ({
        paddingLeft: element === viewport ? '12px' : '6px',
        paddingRight: element === viewport ? '12px' : '6px',
        paddingTop: element === viewport ? '12px' : '6px',
        paddingBottom: element === viewport ? '12px' : '6px',
        borderLeftWidth: '2px',
        borderRightWidth: '2px',
        borderTopWidth: '2px',
        borderBottomWidth: '2px',
        getPropertyValue: () => sideWidth,
      }),
    },
  })
  let pixelCanvas: PixelCanvas | undefined
  try {
    pixelCanvas = new PixelCanvas(
      canvas as unknown as HTMLCanvasElement,
      stage as unknown as HTMLElement,
    )
    assert.equal(canvas.style.width, '512px')
    pixelCanvas.setViewport(viewport as unknown as HTMLElement)
    assert.equal(canvas.style.width, '864px')
    assert.equal(canvas.style.height, '810px')

    // 手机竖屏为下方触控按钮留出空间，并保留完整地图。
    viewport.clientWidth = 390
    viewport.clientHeight = 568
    toolbar.offsetHeight = 82
    controls.offsetHeight = 164
    listeners.get('resize')!()
    assert.equal(canvas.style.height, '282px')
    assert.equal(parseFloat(canvas.style.width) / parseFloat(canvas.style.height), 256 / 240)

    // 横屏从宽度扣除左右触控区；不能使用旧的至少两倍缩放导致溢出。
    viewport.clientWidth = 650
    viewport.clientHeight = 375
    controls.offsetHeight = 0
    sideWidth = '272'
    listeners.get('resize')!()
    assert.equal(canvas.style.height, '253px')
    assert.ok(parseFloat(canvas.style.width) + 272 + 16 <= 626)

    // 重新放大窗口时必须根据独立视口测量，而非已缩小的面板。
    stage.clientWidth = 300
    viewport.clientWidth = 1440
    viewport.clientHeight = 900
    toolbar.offsetHeight = 50
    sideWidth = '0'
    listeners.get('resize')!()
    assert.equal(canvas.style.width, '864px')
    assert.equal(canvas.width, 256)
    assert.equal(canvas.height, 240)
    assert.equal(context.imageSmoothingEnabled, false)

    stage.clientWidth = 1200
    pixelCanvas.setViewport(null)
    assert.equal(canvas.style.width, '512px')
    assert.equal(properties.has('--tank-panel-width'), false)
  } finally {
    pixelCanvas?.dispose()
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
  assert.equal(listeners.size, 0)
})

test('solo retry rebuilds the failed stage with six lives and resets score, upgrades and duration', () => {
  const results: import('../src/games/tank-battle/scene/SceneManager.ts').TankBattleResult[] = []
  const reached: number[] = []
  const manager = new SceneManager(silentAudio(), 1, {
    initialHighScore: 1000,
    onGameOver: (result) => results.push(result),
    onStageReached: (stage) => reached.push(stage),
  })
  const world = () => (manager as unknown as { world: World }).world
  manager.setStartStage(4)
  manager.update({ ...idle, confirmEdge: true })
  assert.equal(world().levelIndex, 4)
  assert.equal(world().players[0].lives, 6)
  assert.equal(manager.isContinued(), true)
  for (let i = 0; i < LEVEL_INTRO_TICKS; i++) manager.update(idle)
  world().players[0].tank!.star = 3
  world().score = 2500
  world().players[0].lives = 1
  world().onPlayerDestroyed()
  manager.update(idle)
  assert.equal(manager.getCurrentKind(), SceneKind.GAME_OVER)
  assert.equal(results.length, 1)
  assert.equal(results[0].continued, true)
  assert.equal(manager.getRetryStage(), 4)
  for (let i = 0; i < 45; i++) manager.update(idle)
  manager.update({ ...idle, confirmEdge: true })
  assert.equal(world().levelIndex, 4)
  assert.equal(world().players[0].lives, 6)
  assert.equal(world().players[0].tank!.star, 0)
  assert.equal(world().score, 0)
  assert.equal(world().base.destroyed, false)
  assert.equal(world().getEnemiesRemaining(), 20)
  assert.equal((manager as unknown as { runTicks: number }).runTicks, 0)
  for (let i = 0; i < LEVEL_INTRO_TICKS; i++) manager.update(idle)
  world().pendingEnemies = []
  world().enemies = []
  manager.update(idle)
  for (let i = 0; i < LEVEL_CLEAR_TICKS; i++) manager.update(idle)
  assert.equal(world().levelIndex, 5, 'continued games advance to the next stage')
  assert.deepEqual(reached, [4, 4, 5])
  for (let i = 0; i < LEVEL_INTRO_TICKS; i++) manager.update(idle)
  world().addScore(50000)
  world().onBaseDestroyed()
  manager.update(idle)
  assert.equal(manager.getRetryStage(), 5, 'base destruction also supports retry')
  manager.setStartStage(null)
  for (let i = 0; i < 45; i++) manager.update(idle)
  manager.update({ ...idle, confirmEdge: true })
  assert.equal(world().levelIndex, 0)
  assert.equal(world().highScore, 1000, 'continued scores never replace the classic high score')
  assert.equal(manager.isContinued(), false)
})

test('only solo campaigns update progress; final-stage victory does not offer retry or save an invalid stage', () => {
  for (const mode of ['solo', 'coop', 'practice', 'custom'] as const) {
    const reached: number[] = []
    const manager = new SceneManager(silentAudio(), 1, {
      customLevel: mode === 'custom' ? LEVELS[0] : undefined,
      onStageReached: (stage) => reached.push(stage),
    })
    if (mode === 'coop') manager.setPlayerCount(2)
    if (mode === 'practice') manager.setPracticeStage(4)
    manager.setStartStage(LEVELS.length - 1)
    manager.update({ ...idle, confirmEdge: true })
    const world = (manager as unknown as { world: World }).world
    assert.equal(world.players[0].lives, 6)
    assert.equal(manager.isContinued(), mode === 'solo')
    assert.deepEqual(reached, mode === 'solo' ? [LEVELS.length - 1] : [])
    for (let i = 0; i < LEVEL_INTRO_TICKS; i++) manager.update(idle)
    if (mode === 'solo') {
      world.pendingEnemies = []
      world.enemies = []
      manager.update(idle)
      for (let i = 0; i < LEVEL_CLEAR_TICKS; i++) manager.update(idle)
      assert.deepEqual(reached, [LEVELS.length - 1])
    } else {
      world.onBaseDestroyed()
      manager.update(idle)
    }
    assert.equal(manager.getCurrentKind(), SceneKind.GAME_OVER)
    assert.equal(manager.getRetryStage(), null)
  }
})

test('tank art and tread frames retain a 16px footprint through every rotation and upgrade', () => {
  const staticSets = [...PLAYER_TANK_SPRITES, ...Object.values(ENEMY_TANK_SPRITES)]
  const movingSets = [...PLAYER_TREAD_SPRITES, ...Object.values(ENEMY_TREAD_SPRITES)]
  for (const [index, directions] of staticSets.entries()) {
    const pixels = directions[0].join('').replaceAll(' ', '').length
    for (let direction = 0; direction < 4; direction += 1) {
      const still = directions[direction]
      const moving = movingSets[index][direction]
      for (const sprite of [still, moving]) {
        assert.equal(sprite.length, 16)
        assert.ok(sprite.every((row) => row.length === 16 && /^[ 123]+$/.test(row)))
        assert.equal(sprite.join('').replaceAll(' ', '').length, pixels)
      }
      assert.deepEqual(
        moving.map((row) => row.replace(/[123]/g, 'x')),
        still.map((row) => row.replace(/[123]/g, 'x')),
        'tread animation must not add pixels outside the tank silhouette',
      )
    }
  }
})

test('wall artwork agrees with collision after partial destruction; foliage remains opaque', () => {
  for (const tile of ['#', '@', '>', 'v', '<', '^', 'r', 'b', 'l', 't']) {
    const rows = emptyMap()
    rows[2] = '..' + tile + '.'.repeat(10)
    const terrain = new TerrainGrid(rows)
    for (let hit = 0; hit < 3; hit += 1) {
      const frame = canvasRecorder()
      drawTerrainCell(frame.context, 2, 2, terrain.getKind(2, 2), terrain.getWallMask(2, 2), 0)
      const painted = new Set(frame.rectangles.map(({ x, y }) => `${x},${y}`))
      for (let y = 32; y < 48; y += 1) {
        for (let x = 32; x < 48; x += 1) {
          assert.equal(painted.has(`${x},${y}`), terrain.blocksTank({ x, y, width: 1, height: 1 }))
        }
      }
      terrain.hitByBullet({ x: 34 + hit * 4, y: 44, width: 4, height: 4 }, 2, Direction.UP)
    }
  }
  const forest = canvasRecorder()
  drawTreeCell(forest.context, 0, 0)
  assert.equal(new Set(forest.rectangles.map(({ x, y }) => `${x},${y}`)).size, 256)
  assert.ok(forest.rectangles.every(({ color }) => /^#[0-9a-f]{6}$/i.test(String(color))))
})

test('powerups and burst frames render valid pixels without advancing their game timers', () => {
  for (const kind of Object.values(PowerUpKind)) {
    const powerUp = new PowerUp(kind, 2, 3)
    const before = JSON.stringify(powerUp)
    const frame = canvasRecorder()
    drawPowerUp(frame.context, powerUp)
    assert.equal(JSON.stringify(powerUp), before)
    assert.ok(frame.rectangles.length > 0)
    assert.ok(
      frame.rectangles.every(
        ({ x, y, color }) =>
          x >= 32 && x < 48 && y >= 48 && y < 64 && /^#[0-9a-f]{6}$/i.test(String(color)),
      ),
    )
  }
  for (const big of [false, true]) {
    const burst = new Explosion(48, 48, big)
    const total = burst.ticksLeft
    const frames = new Set<string>()
    for (const progress of [0, 0.3, 0.6, 0.9]) {
      burst.ticksLeft = Math.ceil(total * (1 - progress))
      const before = JSON.stringify(burst)
      const frame = canvasRecorder()
      drawExplosion(frame.context, burst)
      assert.equal(JSON.stringify(burst), before)
      assert.ok(frame.rectangles.length > 0)
      assert.ok(
        frame.rectangles.every(
          ({ x, y, width, height, color }) =>
            Number.isInteger(x) &&
            Number.isInteger(y) &&
            width === 1 &&
            height === 1 &&
            Math.abs(x - 48) <= (big ? 16 : 8) &&
            Math.abs(y - 48) <= (big ? 16 : 8) &&
            /^#[0-9a-f]{6}$/i.test(String(color)),
        ),
      )
      frames.add(JSON.stringify(frame.rectangles))
    }
    assert.ok(frames.size >= 2)
  }
})
