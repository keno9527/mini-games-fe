import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMap,
  exportMap,
  importMap,
  mapWarnings,
  paintLine,
  protectedCell,
  validateLevel,
  WAVE_PRESETS,
} from '../src/games/tank-battle/editor/maps.ts'
import {
  deleteMap,
  DRAFT_KEY,
  loadDraft,
  loadMaps,
  MAPS_KEY,
  saveDraft,
  saveMap,
} from '../src/games/tank-battle/editor/storage.ts'
import { LEVELS } from '../src/games/tank-battle/data/levels.ts'
import { World, LevelOutcome } from '../src/games/tank-battle/system/World.ts'
import { SceneManager, type TankBattleResult } from '../src/games/tank-battle/scene/SceneManager.ts'
import type { AudioEngine } from '../src/games/tank-battle/core/AudioEngine.ts'
import { LEVEL_CLEAR_TICKS, LEVEL_INTRO_TICKS } from '../src/games/tank-battle/constants.ts'
import { SceneKind, TerrainKind, type InputSnapshot } from '../src/games/tank-battle/types.ts'

const idle: InputSnapshot = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  pauseEdge: false,
  confirmEdge: false,
}
function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
  }
}

test('all classic maps copy into valid editable maps without mutating originals', () => {
  const before = JSON.stringify(LEVELS)
  for (let i = 0; i < 35; i += 1) {
    const map = createMap(i)
    assert.deepEqual(validateLevel(map), [])
    assert.notEqual(map.terrain, LEVELS[i].terrain)
    assert.deepEqual(map.enemyQueue, LEVELS[i].enemyQueue)
    map.terrain.forEach((row, y) =>
      [...row].forEach((tile, x) => {
        assert.equal(tile, protectedCell(x, y) ? '.' : LEVELS[i].terrain[y][x])
      }),
    )
  }
  assert.equal(JSON.stringify(LEVELS), before)
})

test('fast strokes fill every intermediate cell and never overwrite protected areas', () => {
  const before = createMap().terrain
  const next = paintLine(before, [0, 4], [12, 4], '@')
  assert.equal(next[4], '@'.repeat(13))
  assert.equal(before[4], '.'.repeat(13))
  const diagonal = paintLine(before, [0, 0], [12, 12], '#')
  assert.equal(diagonal[0][0], '.')
  for (let i = 1; i < 13; i += 1) assert.equal(diagonal[i][i], '#')
  const base = paintLine(before, [0, 12], [12, 12], '~')
  for (const x of [4, 5, 6, 7, 8]) assert.equal(base[12][x], '.')
})

test('JSON round trip preserves all supported half walls and wave order, and assigns a new local identity', () => {
  let map = createMap()
  const rows = [...map.terrain]
  rows[4] = '#@~*%>v<^rblt'
  map = { ...map, name: '测试地图', terrain: rows, enemyQueue: WAVE_PRESETS.armor.queue }
  const result = importMap(exportMap(map))
  assert.equal(result.name, map.name)
  assert.deepEqual(result.terrain, map.terrain)
  assert.deepEqual(result.enemyQueue, map.enemyQueue)
  assert.notEqual(result.id, map.id)
})

test('imports reject malformed format, oversized content, invalid tiles, protected cells and invalid waves', () => {
  const map = createMap()
  assert.throws(() => importMap('{'), /JSON/)
  assert.throws(() => importMap(' '.repeat(65537)), /64 KB/)
  const invalid = [
    { ...map, version: 2 },
    { ...map, format: 'other' },
    { ...map, name: '' },
    { ...map, terrain: ['.'] },
    { ...map, terrain: map.terrain.map((row, i) => (i === 4 ? '!............' : row)) },
    { ...map, terrain: map.terrain.map((row, i) => (i === 0 ? '#............' : row)) },
    { ...map, enemyQueue: [] },
    { ...map, enemyQueue: Array(20).fill('unknown') },
  ]
  for (const data of invalid) assert.throws(() => importMap(JSON.stringify(data)))
})

test('storage supports save, update, copy and delete; drafts preserve unnamed edits separately', () => {
  const db = storage()
  const first = saveMap(createMap(), db)
  saveMap({ ...first, name: '重命名' }, db)
  assert.equal(loadMaps(db).length, 1)
  assert.equal(loadMaps(db)[0].name, '重命名')
  const copy = saveMap({ ...first, id: crypto.randomUUID() }, db)
  saveDraft({ ...first, name: '', terrain: paintLine(first.terrain, [1, 1], [2, 1], '~') }, db)
  assert.equal(loadDraft(db)?.name, '')
  assert.equal(loadDraft(db)?.terrain[1].slice(1, 3), '~~')
  assert.equal(loadMaps(db)[1].terrain[1], '.'.repeat(13))
  deleteMap(copy.id, db)
  assert.equal(loadMaps(db).length, 1)
  assert.ok(db.getItem(DRAFT_KEY))
})

test('corrupt or full storage fails explicitly without replacing existing maps or draft', () => {
  const db = storage()
  db.setItem(MAPS_KEY, 'broken')
  assert.throws(() => saveMap(createMap(), db))
  assert.equal(db.getItem(MAPS_KEY), 'broken')
  db.setItem(DRAFT_KEY, 'broken')
  assert.throws(() => loadDraft(db))
  assert.equal(db.getItem(DRAFT_KEY), 'broken')
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
  }
  assert.throws(() => saveMap(createMap(), full), /full/)
  assert.throws(() => saveDraft(createMap(), full), /full/)
})

test('blocked exits and inaccessible regions are warnings, not invalid-map errors', () => {
  const map = createMap()
  assert.equal(mapWarnings(map).length, 0)
  const terrain = paintLine(map.terrain, [0, 6], [12, 6], '@')
  const blocked = { ...map, terrain }
  assert.deepEqual(validateLevel(blocked), [])
  assert.ok(mapWarnings(blocked).some((issue) => issue.message.includes('隔断')))
  const brick = { ...map, terrain: paintLine(map.terrain, [0, 6], [12, 6], '#') }
  assert.equal(mapWarnings(brick).length, 0)
})

test('custom world deep-copies its source and resets damage without touching authored or classic maps', () => {
  const map = createMap()
  const terrain = paintLine(map.terrain, [1, 1], [1, 1], '#')
  const source = { ...map, terrain }
  const original = JSON.stringify(source)
  const world = new World(1, 0, 1, source)
  world.loadLevel(0)
  assert.equal(world.terrain.getKind(1, 1), TerrainKind.BRICK)
  world.terrain.clearSpawnCell(1, 1)
  world.pendingEnemies.pop()
  world.terrain.applyShovel()
  assert.equal(JSON.stringify(source), original)
  world.loadLevel(0)
  assert.equal(world.terrain.getKind(1, 1), TerrainKind.BRICK)
  assert.equal(world.pendingEnemies.length, 20)
  terrain[1] = '.'.repeat(13)
  world.loadLevel(0)
  assert.equal(world.terrain.getKind(1, 1), TerrainKind.BRICK)
})

for (const playerCount of [1, 2] as const) {
  test(`custom ${playerCount}-player game ends after one map, retries that map and never reports a campaign score`, () => {
    const source = createMap()
    const results: TankBattleResult[] = []
    const audio = {
      play() {},
      playSequence() {},
      setMotor() {},
      stopAll() {},
    } as unknown as AudioEngine
    const manager = new SceneManager(audio, 1, {
      customLevel: source,
      initialHighScore: 9000,
      onGameOver: (result) => results.push(result),
    })
    manager.setPlayerCount(playerCount)
    manager.update({ ...idle, confirmEdge: true })
    const inspect = manager as unknown as { world: World }
    for (let i = 0; i < LEVEL_INTRO_TICKS; i += 1) manager.update(idle)
    assert.equal(inspect.world.players.length, playerCount)
    assert.deepEqual(
      inspect.world.players.map((player) => player.lives),
      Array(playerCount).fill(10),
    )
    inspect.world.score = 700
    inspect.world.highScore = 700
    inspect.world.outcome = LevelOutcome.CLEARED
    manager.update(idle)
    for (let i = 0; i < LEVEL_CLEAR_TICKS; i += 1) manager.update(idle)
    assert.equal(manager.getCurrentKind(), SceneKind.GAME_OVER)
    assert.equal(results.length, 1)
    assert.equal(results[0].practice, true)
    assert.equal(results[0].victory, true)
    assert.equal(results[0].highScore, 700)
    for (let i = 0; i < 46; i += 1) manager.update(idle)
    manager.update({ ...idle, confirmEdge: true })
    assert.equal(manager.getCurrentKind(), SceneKind.BATTLE)
    assert.equal(inspect.world.players.length, playerCount)
    assert.equal(inspect.world.highScore, 0)
    assert.equal(inspect.world.terrain.getKind(1, 1), TerrainKind.EMPTY)
    assert.equal(inspect.world.pendingEnemies.length, 20)
  })
}
