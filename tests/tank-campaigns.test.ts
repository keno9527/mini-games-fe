import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { CAMPAIGNS, TANK_A_LEVELS } from '../src/games/tank-battle/data/campaigns.ts'
import { BASE_CELL, LEVELS } from '../src/games/tank-battle/data/levels.ts'
import { World } from '../src/games/tank-battle/system/World.ts'
import { SceneManager, type TankBattleResult } from '../src/games/tank-battle/scene/SceneManager.ts'
import { BattleScene } from '../src/games/tank-battle/scene/BattleScene.ts'
import type { AudioEngine } from '../src/games/tank-battle/core/AudioEngine.ts'
import { idleControls } from '../src/features/gamepad/players.ts'
import { LEVEL_CLEAR_TICKS, LEVEL_INTRO_TICKS } from '../src/games/tank-battle/constants.ts'
import { SceneKind, TerrainKind } from '../src/games/tank-battle/types.ts'
import { isValidStage, loadProgress, saveProgress } from '../src/games/tank-battle/progress.ts'

const idle = idleControls()
const audio = {
  play() {},
  playSequence() {},
  stopAll() {},
  setMotor() {},
} as unknown as AudioEngine

test('Tank A stages 1–50 match independent 6502 extraction, including transformed and repeated maps', () => {
  assert.equal(TANK_A_LEVELS.length, 50)
  assert.equal(CAMPAIGNS['battle-city'].levels, LEVELS)
  assert.equal(LEVELS.length, 35)
  const terrain = TANK_A_LEVELS.flatMap((level) => level.terrain).join('\n')
  // Recorded by independently executing $EF76 with $46=0 and $85=1..50,
  // capturing each $D80B call (169 tiles per stage) from the pinned source ROM.
  assert.equal(
    createHash('sha256').update(terrain).digest('hex'),
    'a2fa79da232e5daed4ef91d6d4b7f1dbe845df0b3e2cf8e4580cfc2d50d96f45',
  )
  assert.equal(new Set(TANK_A_LEVELS.map((level) => level.terrain.join('\n'))).size, 36)
  assert.deepEqual(TANK_A_LEVELS[36].terrain, TANK_A_LEVELS[0].terrain)
  assert.notDeepEqual(TANK_A_LEVELS[12].terrain, TANK_A_LEVELS[0].terrain)
  assert.equal(TANK_A_LEVELS[49].terrain[0], '...@......*#.')
  for (const level of TANK_A_LEVELS) {
    assert.equal(level.terrain.length, 13)
    for (const row of level.terrain) assert.match(row, /^[.#@~*%>v<^rblt]{13}$/)
    assert.equal(level.enemyQueue.length, 20)
  }
  assert.deepEqual(
    TANK_A_LEVELS[49].enemyQueue,
    LEVELS[34].enemyQueue,
    'map-only adaptation retains the existing final-stage difficulty',
  )
})

test('Tank A progress is isolated by campaign and user, and existing classic saves remain readable', () => {
  const values = new Map([['mini-games-tank-progress-v1:user:p1', '34']])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  assert.equal(loadProgress('p1', storage), 34)
  assert.equal(loadProgress('p1', storage, 'tank-a'), 0)
  saveProgress(49, 'p1', storage, 'tank-a')
  saveProgress(10, 'p1', storage, 'tank-a')
  assert.equal(loadProgress('p1', storage, 'tank-a'), 49)
  assert.equal(loadProgress('p1', storage), 34)
  assert.equal(loadProgress('p2', storage, 'tank-a'), 0)
  assert.equal(loadProgress(undefined, storage, 'tank-a'), 0)
  saveProgress(40, undefined, storage, 'tank-a')
  assert.equal(loadProgress(undefined, storage, 'tank-a'), 40)
  assert.equal(loadProgress(undefined, storage), 0)
  assert.equal(isValidStage(49, 'tank-a'), true)
  for (const stage of [-1, 50, NaN, 1.5]) {
    assert.equal(isValidStage(stage, 'tank-a'), false)
    assert.throws(() => saveProgress(stage, 'p1', storage, 'tank-a'))
  }
  assert.throws(() => saveProgress(49, 'p1', storage))
})

test('all 50 Tank A stages spawn both players safely and can render and simulate', () => {
  const context = new Proxy(
    {},
    { get: () => () => {}, set: () => true },
  ) as CanvasRenderingContext2D
  const world = new World(42, 0, 2, undefined, 'tank-a')
  const before = JSON.stringify(TANK_A_LEVELS)
  for (let stage = 0; stage < 50; stage++) {
    const scene = new BattleScene(world, audio, { onGameOver() {} })
    scene.startLevel(stage)
    assert.equal(world.levelCount, 50)
    assert.equal(
      world.terrain.getKind(...BASE_CELL),
      TerrainKind.EMPTY,
      `base in stage ${stage + 1}`,
    )
    assert.equal(world.terrain.getWallMask(...BASE_CELL), 0)
    for (const player of world.players) {
      assert.ok(player.tank)
      assert.equal(world.terrain.blocksTank(player.tank.getRect()), false, `stage ${stage + 1}`)
    }
    for (let tick = 0; tick < LEVEL_INTRO_TICKS + 120; tick++) scene.update(idle)
    scene.render(context)
    assert.ok(world.enemies.length > 0)
    for (const tank of [...world.getPlayerTanks(), ...world.enemies]) {
      assert.ok(Number.isFinite(tank.x) && tank.x >= 0 && tank.x <= 192)
      assert.ok(Number.isFinite(tank.y) && tank.y >= 0 && tank.y <= 192)
    }
  }
  assert.equal(JSON.stringify(TANK_A_LEVELS), before)
})

test('Tank A campaign advances past 35, keeps upgrades, saves stage 50 and ends exactly once', () => {
  const reached: number[] = []
  const results: TankBattleResult[] = []
  const manager = new SceneManager(audio, 1, {
    campaignId: 'tank-a',
    initialHighScore: 9999,
    onStageReached: (stage) => reached.push(stage),
    onGameOver: (result) => results.push(result),
  })
  manager.update({ ...idle, confirmEdge: true })
  const world = (manager as unknown as { world: World }).world
  assert.equal(world.highScore, 0, 'classic high score must not leak into Tank A')
  world.players[0].tank!.star = 2
  for (let stage = 0; stage < 50; stage++) {
    assert.equal(world.levelIndex, stage)
    assert.equal(world.players[0].tank!.star, 2)
    for (let tick = 0; tick < LEVEL_INTRO_TICKS; tick++) manager.update(idle)
    world.pendingEnemies = []
    world.enemies = []
    manager.update(idle)
    for (let tick = 0; tick < LEVEL_CLEAR_TICKS; tick++) manager.update(idle)
  }
  assert.equal(manager.getCurrentKind(), SceneKind.GAME_OVER)
  for (let tick = 0; tick < 100; tick++) manager.update(idle)
  assert.deepEqual(
    reached,
    Array.from({ length: 50 }, (_, i) => i),
  )
  assert.equal(results.length, 1)
  assert.equal(results[0].campaignId, 'tank-a')
  assert.equal(results[0].victory, true)
  assert.equal(results[0].levelReached, 50)
  assert.equal(manager.getRetryStage(), null)
})

test('Tank A stage 50 supports continuation, failure retry and single-stage practice', () => {
  for (const practice of [false, true]) {
    const reached: number[] = []
    const results: TankBattleResult[] = []
    const manager = new SceneManager(audio, 1, {
      campaignId: 'tank-a',
      onStageReached: (stage) => reached.push(stage),
      onGameOver: (result) => results.push(result),
    })
    if (practice) manager.setPracticeStage(49)
    else manager.setStartStage(49)
    manager.update({ ...idle, confirmEdge: true })
    let world = (manager as unknown as { world: World }).world
    assert.equal(world.levelIndex, 49)
    for (let tick = 0; tick < LEVEL_INTRO_TICKS; tick++) manager.update(idle)
    if (!practice) {
      world.onBaseDestroyed()
      manager.update(idle)
      assert.equal(manager.getRetryStage(), 49)
      for (let tick = 0; tick < 45; tick++) manager.update(idle)
      manager.update({ ...idle, confirmEdge: true })
      world = (manager as unknown as { world: World }).world
      assert.equal(world.levelIndex, 49)
      assert.equal(world.players[0].lives, 6)
      for (let tick = 0; tick < LEVEL_INTRO_TICKS; tick++) manager.update(idle)
    }
    world.pendingEnemies = []
    world.enemies = []
    manager.update(idle)
    for (let tick = 0; tick < LEVEL_CLEAR_TICKS; tick++) manager.update(idle)
    assert.equal(results.at(-1)?.victory, true)
    assert.equal(results.at(-1)?.practice, practice)
    assert.deepEqual(reached, practice ? [] : [49, 49])
  }
})
