import test from 'node:test'
import assert from 'node:assert/strict'
import { World, LevelOutcome } from '../src/games/tank-battle/system/World.ts'
import { updatePlayer } from '../src/games/tank-battle/system/PlayerController.ts'
import { updateSpawning } from '../src/games/tank-battle/system/SpawnManager.ts'
import { updatePowerUps } from '../src/games/tank-battle/system/PowerUpSystem.ts'
import { updateBullets } from '../src/games/tank-battle/system/BulletSystem.ts'
import { PowerUp } from '../src/games/tank-battle/entity/PowerUp.ts'
import { Bullet } from '../src/games/tank-battle/entity/Bullet.ts'
import { Direction, PowerUpKind, TankSide } from '../src/games/tank-battle/types.ts'
import { idleControls, GamepadPlayers } from '../src/features/gamepad/players.ts'
import { BattleScene } from '../src/games/tank-battle/scene/BattleScene.ts'
import { SceneManager } from '../src/games/tank-battle/scene/SceneManager.ts'
import { SceneKind } from '../src/games/tank-battle/types.ts'
import type { AudioEngine } from '../src/games/tank-battle/core/AudioEngine.ts'
import { LEVEL_INTRO_TICKS } from '../src/games/tank-battle/constants.ts'

const audio = {
  play() {},
  playSequence() {},
  setMotor() {},
  stopAll() {},
} as unknown as AudioEngine
const silent = () => {}
function world(count: 1 | 2 = 2) {
  const w = new World(42, 0, count)
  w.loadLevel(0)
  w.terrain.load(Array(13).fill('.............'))
  return w
}

test('one controller controls only P1; two controllers move and fire independently', () => {
  const w = world()
  const controls = new GamepadPlayers()
  controls.setPlayerCount(2)
  const pad = (index: number, axes = [0, 0], fire = false) => ({
    index,
    id: `pad-${index}`,
    mapping: 'standard',
    axes,
    buttons: [{ pressed: fire, touched: false, value: Number(fire) }],
  })
  controls.update({ status: 'ready', devices: [pad(3), pad(7)] })
  controls.bind(0, 3)
  controls.bind(1, 7)
  controls.update({ status: 'ready', devices: [pad(3, [-1, 0], true), pad(7, [1, 0], true)] })
  const p1 = w.players[0].tank!
  const p2 = w.players[1].tank!
  const x1 = p1.x,
    x2 = p2.x
  updatePlayer(w, controls.consume(0), silent, 0)
  updatePlayer(w, controls.consume(1), silent, 1)
  assert.ok(p1.x < x1)
  assert.ok(p2.x > x2)
  assert.deepEqual(
    w.bullets.map((b) => b.ownerId),
    [p1.id, p2.id],
  )
  assert.equal(world(1).players.length, 1)
})

test('teammates block movement but player bullets do not damage teammates', () => {
  const w = world()
  const a = w.players[0].tank!,
    b = w.players[1].tank!
  a.x = 32
  a.y = 48
  b.x = 48
  b.y = 48
  b.shieldTicks = 0
  updatePlayer(w, { ...idleControls(), right: true }, silent)
  assert.equal(a.x, 32)
  w.bullets.push(
    new Bullet({
      ownerId: a.id,
      ownerSide: TankSide.PLAYER,
      x: b.x,
      y: b.y + 5,
      direction: Direction.RIGHT,
      speed: 1,
      power: 1,
    }),
  )
  updateBullets(w, silent)
  assert.equal(b.alive, true)
  assert.equal(w.players[1].lives, 6)
})

test('enemy hits P2, independent respawn waits for a free spawn point', () => {
  const w = world()
  const p2 = w.players[1].tank!
  p2.shieldTicks = 0
  w.bullets.push(
    new Bullet({
      ownerId: 'enemy',
      ownerSide: TankSide.ENEMY,
      x: p2.x + 5,
      y: p2.y,
      direction: Direction.DOWN,
      speed: 1,
      power: 1,
    }),
  )
  updateBullets(w, silent)
  assert.equal(w.players[1].tank, null)
  assert.equal(w.players[1].lives, 5)
  assert.equal(w.players[0].lives, 6)
  w.players[1].respawnDelayTicks = 1
  const p1 = w.players[0].tank!
  p1.x = p2.x
  p1.y = p2.y
  updateSpawning(w)
  assert.equal(w.players[1].tank, null)
  p1.x = 32
  updateSpawning(w)
  assert.equal(w.players[1].tank?.playerSlot, 1)
  assert.ok(w.players[1].tank!.shieldTicks > 0)
})

test('one eliminated player does not end coop or return on next level; both eliminated or base loss ends it', () => {
  const w = world()
  w.players[0].lives = 1
  w.onPlayerDestroyed(0)
  assert.equal(w.outcome, LevelOutcome.ONGOING)
  w.players[1].tank!.star = 2
  w.loadLevel(1)
  assert.equal(w.players[0].tank, null)
  assert.equal(w.players[1].tank!.star, 2)
  w.players[1].lives = 1
  w.onPlayerDestroyed(1)
  assert.equal(w.outcome, LevelOutcome.FAILED)
  const single = world(1)
  single.players[0].lives = 1
  single.onPlayerDestroyed()
  assert.equal(single.outcome, LevelOutcome.FAILED)
  const base = world()
  base.onBaseDestroyed()
  assert.equal(base.outcome, LevelOutcome.FAILED)
})

test('personal powerups affect the collector, global powerups and score are shared', () => {
  const w = world()
  const p2 = w.players[1].tank!
  w.powerUps = [PowerUpKind.STAR, PowerUpKind.TANK, PowerUpKind.TIMER].map(
    (kind) => new PowerUp(kind, p2.x / 16, p2.y / 16),
  )
  updatePowerUps(w, silent)
  assert.equal(p2.star, 1)
  assert.equal(w.players[0].tank!.star, 0)
  assert.equal(w.players[0].lives, 6)
  assert.equal(w.players[1].lives, 7)
  assert.ok(w.freezeTicks > 0)
  assert.ok(w.score > 0)
  const score = w.score
  updatePowerUps(w, silent)
  assert.equal(w.score, score)
})

test('external suspension freezes intro and battle until explicit resume', () => {
  const w = world()
  const scene = new BattleScene(w, audio, { onGameOver: silent })
  scene.onEnter()
  scene.suspend()
  for (let i = 0; i < LEVEL_INTRO_TICKS + 10; i++) scene.update(idleControls())
  assert.equal(scene.isPaused(), true)
  assert.equal(w.enemies.length, 0)
  scene.update({ ...idleControls(), pauseEdge: true })
  for (let i = 0; i < LEVEL_INTRO_TICKS; i++) scene.update(idleControls())
  scene.update(idleControls())
  assert.ok(w.enemies.length > 0)
  scene.update({ ...idleControls(), pauseEdge: true })
  scene.suspend()
  scene.update({ ...idleControls(), pauseEdge: true })
  assert.equal(
    scene.isPaused(),
    false,
    'resuming needs only one press even after blur during manual pause',
  )
})

test('game over restart keeps selected player count and resets independent lives', () => {
  const manager = new SceneManager(audio, 10)
  manager.setPlayerCount(2)
  manager.update({ ...idleControls(), confirmEdge: true })
  assert.equal(manager.getCurrentKind(), SceneKind.BATTLE)
  // Inspect world state to verify the scene manager carries configuration into each new run.
  const getWorld = () => (manager as unknown as { world: World }).world
  assert.equal(getWorld().players.length, 2)
  manager.setPlayerCount(1) // ignored during a run
  getWorld().onBaseDestroyed()
  for (let i = 0; i <= LEVEL_INTRO_TICKS; i++) manager.update(idleControls())
  assert.equal(manager.getCurrentKind(), SceneKind.GAME_OVER)
  manager.update({ ...idleControls(), confirmEdge: true })
  assert.equal(getWorld().players.length, 2)
  assert.deepEqual(
    getWorld().players.map((p) => p.lives),
    [6, 6],
  )
})

test('cooperative players spawn safely through all 35 stages and retain separate upgrades', () => {
  const w = world()
  for (let stage = 0; stage < 35; stage++) {
    w.players[0].tank!.star = 1
    w.players[1].tank!.star = 2
    w.loadLevel(stage)
    for (const [slot, player] of w.players.entries()) {
      assert.equal(
        w.terrain.blocksTank(player.tank!.getRect()),
        false,
        `stage ${stage + 1}, P${slot + 1}`,
      )
      assert.equal(player.tank!.star, slot + 1)
    }
  }
})

test('cooperative bonus life rewards active players once without reviving eliminated teammates', () => {
  const w = world()
  w.addScore(20000)
  assert.deepEqual(
    w.players.map((player) => player.lives),
    [7, 7],
  )
  w.addScore(20000)
  assert.deepEqual(
    w.players.map((player) => player.lives),
    [7, 7],
  )
  const depleted = world()
  depleted.players[0].lives = 1
  depleted.onPlayerDestroyed(0)
  depleted.addScore(20000)
  assert.deepEqual(
    depleted.players.map((player) => player.lives),
    [0, 7],
  )
})

test('two-player practice preserves player count after returning to title', () => {
  const manager = new SceneManager(audio, 42)
  manager.setPlayerCount(2)
  manager.setPracticeStage(34)
  manager.update({ ...idleControls(), confirmEdge: true })
  const getWorld = () => (manager as unknown as { world: World }).world
  assert.equal(getWorld().levelIndex, 34)
  assert.equal(getWorld().players.length, 2)
  manager.suspend()
  manager.returnToTitle()
  manager.update({ ...idleControls(), confirmEdge: true })
  assert.equal(getWorld().levelIndex, 34)
  assert.deepEqual(
    getWorld().players.map((player) => player.lives),
    [6, 6],
  )
})
