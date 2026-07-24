import test from 'node:test'
import assert from 'node:assert/strict'

import { getCatalogGame } from '../src/features/games/data.ts'
import * as engine from '../src/games/tower-defense/engine.ts'

test('tower defense is registered as a playable catalog game', () => {
  const game = getCatalogGame('tower-defense')

  assert.ok(game)
  assert.equal(game.name, '绿野防线')
  assert.deepEqual(game.difficulties, ['守卫战'])
})

test('a tower can only be placed on open ground when there is enough gold', () => {
  const initial = engine.createGameState()
  const placed = engine.placeTower(initial, 'sprout', 1, 1)

  assert.equal(placed.towers.length, 1)
  assert.equal(placed.gold, initial.gold - engine.TOWER_DEFINITIONS.sprout.cost)
  assert.equal(engine.canPlaceTower(placed, 'sprout', 1, 1).ok, false)

  const [pathColumn, pathRow] = engine.PATH_TILES[0]
  assert.equal(engine.canPlaceTower(initial, 'sprout', pathColumn, pathRow).ok, false)
  assert.equal(
    engine.canPlaceTower({ ...initial, gold: 0 }, 'sprout', 1, 1).ok,
    false,
  )
})

test('starting a wave releases enemies that damage the base when they escape', () => {
  let state = engine.startNextWave(engine.createGameState())
  assert.equal(state.phase, 'wave')
  assert.equal(state.wave, 1)

  state = engine.stepGame(state, 60)

  assert.ok(state.lives < engine.INITIAL_LIVES)
  assert.equal(state.phase, 'defeat')
})

test('towers target enemies in range and award gold and score for a kill', () => {
  let state = engine.createGameState()
  state = engine.placeTower(state, 'sprout', 1, 2)
  state = engine.startNextWave(state)

  for (let tick = 0; tick < 120 && state.score === 0; tick += 1) {
    state = engine.stepGame(state, 0.1)
  }

  assert.ok(state.score > 0)
  assert.ok(state.gold > engine.INITIAL_GOLD - engine.TOWER_DEFINITIONS.sprout.cost)
})

test('frost towers slow enemies and cannon towers damage nearby enemies', () => {
  const initial = engine.createGameState()
  const frostState = engine.stepGame(
    {
      ...engine.placeTower(initial, 'frost', 1, 2),
      phase: 'wave',
      wave: 1,
      enemies: [
        engine.createEnemy('scout', 1, 0.7),
      ],
    },
    0.1,
  )
  assert.ok(frostState.enemies[0].slowTimer > 0)
  assert.equal(engine.TOWER_DEFINITIONS.frost.slowMultiplier, 0.48)

  const slowedProgress = frostState.enemies[0].progress
  const slowedState = engine.stepGame(
    { ...frostState, towers: [] },
    1,
  )
  const expectedProgress = slowedProgress
    + engine.ENEMY_DEFINITIONS.scout.speed * engine.TOWER_DEFINITIONS.frost.slowMultiplier
  assert.ok(Math.abs(slowedState.enemies[0].progress - expectedProgress) < 0.000001)

  const cannonState = engine.stepGame(
    {
      ...engine.placeTower(initial, 'cannon', 1, 2),
      phase: 'wave',
      wave: 1,
      enemies: [
        engine.createEnemy('scout', 1, 0.8),
        engine.createEnemy('scout', 2, 0.9),
      ],
    },
    0.1,
  )
  assert.ok(cannonState.enemies.every(enemy => enemy.hp < enemy.maxHp))
})

test('towers can be upgraded and sold without allowing upgrades past level three', () => {
  let state = engine.placeTower(engine.createGameState(), 'sprout', 1, 1)
  const towerId = state.towers[0].id
  state = engine.upgradeTower(state, towerId)
  state = engine.upgradeTower(state, towerId)
  const maxed = engine.upgradeTower(state, towerId)

  assert.equal(maxed.towers[0].level, 3)
  assert.equal(maxed.gold, state.gold)

  const sold = engine.sellTower(maxed, towerId)
  assert.equal(sold.towers.length, 0)
  assert.ok(sold.gold > maxed.gold)
})

test('clearing the fifth wave wins the game while losing all lives ends it', () => {
  const victory = engine.stepGame(
    {
      ...engine.createGameState(),
      phase: 'wave',
      wave: engine.WAVES.length,
      spawnQueue: [],
      enemies: [],
    },
    0.1,
  )
  assert.equal(victory.phase, 'victory')

  const defeat = engine.stepGame(
    {
      ...engine.createGameState(),
      phase: 'wave',
      wave: 1,
      lives: 1,
      spawnQueue: [],
      enemies: [
        {
          ...engine.createEnemy('scout', 1, 0),
          progress: engine.PATH_POINTS.length - 1,
        },
      ],
    },
    0.1,
  )
  assert.equal(defeat.phase, 'defeat')
  assert.equal(defeat.lives, 0)
})
