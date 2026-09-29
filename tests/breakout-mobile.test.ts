import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MobileGame,
  CONFIG,
  EFFECT_FRAMES,
  type PowerUpType,
} from '../src/games/breakout-mobile/game.ts'
import { MobileSave, MOBILE_SAVE_KEY } from '../src/games/breakout-mobile/storage.ts'
import { PaddleDrag, fitCanvas } from '../src/games/breakout-mobile/input.ts'
import { W, H, PADDLE_Y, BALL_R } from '../src/games/breakout/physics.ts'
import { LEVEL_LAYOUTS } from '../src/games/breakout/levels.ts'
import { AUDIO_SETTINGS_KEY } from '../src/games/breakout/audio.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

test('mobile entry has its own manifest, lazy runtime and game ID', async () => {
  const { getGameManifest, getGameComponent } = await import('../src/games/registry.ts')
  const mobile = getGameManifest('breakout-mobile')!
  assert.equal(mobile.game.name, '打砖块（手机端）')
  assert.deepEqual(mobile.game.difficulties, ['关卡挑战'])
  assert.equal(mobile.runtime.kind, 'embedded')
  assert.ok(getGameComponent('breakout-mobile'))
  assert.notEqual(getGameComponent('breakout'), getGameComponent('breakout-mobile'))
  assert.equal(getGameManifest('breakout')!.game.name, '打砖块')
})

test('touch down does not move or launch; one pointer controls relative movement at display scale', () => {
  const game = new MobileGame()
  const input = new PaddleDrag()
  assert.equal(input.begin(7, 100, game.paddleX, W / 2), true)
  assert.equal(input.begin(8, 200, game.paddleX, W / 2), false)
  assert.equal(game.paddleX, W / 2)
  assert.equal(game.status, 'ready')
  assert.equal(input.move(8, 300, 44), null)
  game.moveTo(input.move(7, 130, 44)!)
  assert.equal(game.paddleX, 300)
  assert.equal(game.balls[0].x, 300)
  assert.equal(game.balls[0].vx, 0)
  assert.equal(game.status, 'ready')
  assert.equal(input.move(7, 1000, 44), W - 44)
  assert.equal(input.move(7, 999, 44), W - 46, 'edge reversals respond immediately')
  assert.equal(input.end(8), null)
  assert.equal(input.end(7), 7)
  assert.equal(input.move(7, 150, 44), null)
  assert.equal(input.begin(9, 100, 240, 200), true)
  assert.equal(input.end(), 9, 'cancel, resize and leave can release the active pointer')
  assert.equal(input.begin(10, 100, 240, 0), false)
})

test('canvas fits both width and available height at every target screen size', () => {
  for (const width of [296, 351, 366, 406])
    for (const height of [120, 220, 360, 600]) {
      const fit = fitCanvas(width, height)
      assert.ok(fit.width <= width && fit.height <= height)
      assert.ok(Math.abs(fit.width / W - fit.height / H) < 0.003)
      assert.ok(fit.width > 0 && fit.height > 0)
    }
})

test('pause freezes physics and effects; repeated pause preserves ready/playing resume target', () => {
  const game = new MobileGame()
  game.pause()
  game.pause(true)
  game.launch()
  assert.equal(game.status, 'paused')
  game.resume()
  assert.equal(game.status, 'ready')
  game.launch()
  game.effects.laser = 20
  game.tick()
  game.pause()
  const frozen = JSON.stringify([game.balls, game.effects, game.score, game.lives])
  game.tick()
  game.frame(100000)
  game.moveTo(0)
  assert.equal(JSON.stringify([game.balls, game.effects, game.score, game.lives]), frozen)
  game.pause(true)
  game.resume()
  assert.equal(game.status, 'playing')
  game.frame(100000)
  assert.equal(
    JSON.stringify([game.balls, game.effects, game.score, game.lives]),
    frozen,
    'resume starts a fresh frame clock',
  )
})

test('30, 60 and 120 Hz preserve mobile physics speed', () => {
  const samples: string[] = []
  for (const hz of [30, 60, 120]) {
    const game = new MobileGame(0, () => 0.9)
    game.launch()
    for (let i = 0; i <= hz; i++) game.frame((i * 1000) / hz)
    samples.push(JSON.stringify([game.balls, game.score, game.effects]))
  }
  assert.equal(samples[0], samples[1])
  assert.equal(samples[1], samples[2])
})

test('life loss clears powerups and waits for explicit launch; defeat settles exactly once', () => {
  const game = new MobileGame()
  const saves: number[][] = []
  game.onSettlement = (level, score) => saves.push([level, score])
  game.launch()
  game.effects.laser = 10
  game.effects.wider = 10
  game.balls = []
  game.tick()
  assert.equal(game.status, 'ready')
  assert.equal(game.lives, 2)
  assert.equal(game.effects.laser, 0)
  assert.equal(game.lasers.length, 0)
  assert.equal(game.powerups.length, 0)
  assert.equal(game.balls[0].vx, 0)
  assert.equal(saves.length, 0)
  game.launch()
  game.lives = 1
  game.score = 123
  game.balls = []
  game.tick()
  game.tick()
  assert.equal(game.status, 'lost')
  assert.deepEqual(saves, [[1, 123]])
  game.reset()
  assert.equal(game.status, 'ready')
  assert.equal(game.score, 0)
  assert.equal(game.lives, 3)
})

test('clear wins over loss, persists next level and cumulative score, final clear stays within 30 levels', () => {
  const game = new MobileGame(3)
  const saves: number[][] = []
  game.onSettlement = (level, score) => saves.push([level, score])
  game.launch()
  game.score = 450
  game.bricks = []
  game.balls = []
  game.tick()
  assert.equal(game.status, 'ready')
  assert.equal(game.level, 4)
  assert.equal(game.lives, 3)
  assert.equal(game.score, 650)
  assert.deepEqual(saves, [[5, 650]])
  game.reset(LEVEL_LAYOUTS.length - 1)
  game.launch()
  game.score = 1000
  game.bricks = []
  game.tick()
  game.tick()
  assert.equal(game.status, 'won')
  assert.equal(game.level, 29)
  assert.deepEqual(saves, [
    [5, 650],
    [30, 1300],
  ])
})

test('every mobile pickup preserves its gameplay effect, with automatic lasers and capped lives/balls', () => {
  for (const type of ['wider', 'multiball', 'laser', 'slow', 'pierce', 'life'] as PowerUpType[]) {
    const game = new MobileGame()
    game.launch()
    game.powerups = [{ x: game.paddleX, y: PADDLE_Y - 5, type }]
    game.tick()
    assert.equal(game.powerups.length, 0)
    if (type === 'wider') assert.equal(game.paddleWidth, CONFIG.paddle * 1.5)
    if (type === 'multiball') assert.equal(game.balls.length, 3)
    if (type === 'laser') {
      assert.equal(game.lasers.length, 2)
      assert.equal(game.effects.laser, EFFECT_FRAMES)
    }
    if (type === 'slow')
      assert.ok(
        Math.abs(Math.hypot(game.balls[0].vx, game.balls[0].vy) - CONFIG.ballSpeed * 0.7) < 1e-6,
      )
    if (type === 'pierce') assert.equal(game.balls[0].piercing, true)
    if (type === 'life') assert.equal(game.lives, 4)
  }
  const game = new MobileGame()
  game.launch()
  game.lives = 9
  game.powerups = [{ x: game.paddleX, y: PADDLE_Y - 5, type: 'life' }]
  game.tick()
  assert.equal(game.lives, 9)
  for (let i = 0; i < 4; i++) {
    game.powerups = [{ x: game.paddleX, y: PADDLE_Y - 5, type: 'multiball' }]
    game.tick()
  }
  assert.equal(game.balls.length, 12)
})

test('automatic laser breaks a brick without a separate fire action', () => {
  const game = new MobileGame()
  const brick = { ...game.bricks[0], x: 188, y: PADDLE_Y - 36, hp: 1, type: 'normal' as const }
  game.bricks = [brick]
  game.launch()
  game.balls[0].y = 300
  game.effects.laser = 100
  game.tick()
  assert.equal(brick.alive, false)
  assert.ok(game.score > 0)
})

test('new mobile save never reads or writes desktop keys; reload starts ready at saved level', () => {
  const storage = memoryStorage()
  storage.setItem(AUDIO_SETTINGS_KEY, '{"enabled":false,"volume":0.1}')
  const save = new MobileSave(() => storage)
  assert.equal(save.data.audio.enabled, true)
  save.update({ lastPlayedLevel: 7, bestScore: 420, audio: { enabled: false, volume: 0.25 } })
  const restored = new MobileSave(() => storage)
  assert.deepEqual(restored.data, save.data)
  const game = new MobileGame(restored.data.lastPlayedLevel - 1)
  assert.equal(game.level, 6)
  assert.equal(game.status, 'ready')
  assert.equal(game.balls[0].y, PADDLE_Y - BALL_R - 1)
  assert.equal(game.score, 0)
  restored.update({ bestScore: 5 })
  assert.equal(restored.data.bestScore, 420)
  assert.equal(storage.getItem(AUDIO_SETTINGS_KEY), '{"enabled":false,"volume":0.1}')
  assert.deepEqual([...storage.values.keys()], [AUDIO_SETTINGS_KEY, MOBILE_SAVE_KEY])
})

test('corrupt and unsupported saves remain unchanged while the in-memory session continues', () => {
  for (const raw of ['{bad', 'null', '{"version":2}', '{"version":1,"lastPlayedLevel":31}']) {
    const storage = memoryStorage()
    storage.setItem(MOBILE_SAVE_KEY, raw)
    const save = new MobileSave(() => storage)
    assert.ok(save.error)
    save.update({ lastPlayedLevel: 3, bestScore: 200 })
    assert.equal(save.data.lastPlayedLevel, 3)
    assert.equal(save.data.bestScore, 200)
    assert.equal(storage.getItem(MOBILE_SAVE_KEY), raw)
  }
})

test('unavailable or full storage does not block progress and successful later writes recover', () => {
  const denied = new MobileSave(() => {
    throw new Error('Denied')
  })
  denied.update({ bestScore: 30 })
  assert.equal(denied.data.bestScore, 30)
  assert.ok(denied.error)
  const storage = memoryStorage()
  let full = true
  const save = new MobileSave(() => ({
    getItem: storage.getItem,
    setItem: (key, value) => {
      if (full) throw new Error('Quota')
      storage.setItem(key, value)
    },
  }))
  save.update({ bestScore: 100 })
  assert.ok(save.error)
  assert.equal(save.data.bestScore, 100)
  full = false
  save.update({ lastPlayedLevel: 2 })
  assert.equal(save.error, '')
  assert.equal(new MobileSave(() => storage).data.bestScore, 100)
})

test('another tab cannot lower the best score or overwrite a newly corrupted save', () => {
  const storage = memoryStorage()
  const a = new MobileSave(() => storage)
  const b = new MobileSave(() => storage)
  a.update({ bestScore: 1000 })
  b.update({ bestScore: 10, lastPlayedLevel: 3 })
  assert.equal(new MobileSave(() => storage).data.bestScore, 1000)
  storage.setItem(MOBILE_SAVE_KEY, 'corrupted elsewhere')
  b.update({ bestScore: 2000 })
  assert.equal(storage.getItem(MOBILE_SAVE_KEY), 'corrupted elsewhere')
  assert.ok(b.error)
})
