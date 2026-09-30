import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createState,
  positions,
  queueDirection,
  step,
  type SnakeState,
} from '../src/games/snake/engine.ts'
import { levels, type Direction } from '../src/games/snake/levels.ts'
import {
  readProgress,
  recordCompletion,
  saveProgress,
  unlockedLevel,
} from '../src/games/snake/progression.ts'
import {
  hydratePlayerFile,
  loadPlayerFile,
  readPlayerProgress,
  stageProgress,
} from '../src/api/playerFiles.ts'
import { createRecord, createUser } from '../src/api/index.ts'
import { playerFixture, withPlayerServer } from './helpers/player-server.ts'
import { routes } from './helpers/snake-routes.ts'

test('all nine maps have valid, unique goals and paired mechanisms', () => {
  assert.equal(levels.length, 9)
  assert.equal(new Set(levels.map((level) => level.id)).size, 9)
  for (const level of levels) {
    assert.equal(level.map.length, 12)
    for (const row of level.map) {
      assert.equal(row.length, 16)
      assert.match(row, /^#[#.os^abABPQ*E]+#$/)
    }
    assert.equal(level.map[0], '#'.repeat(16))
    assert.equal(level.map.at(-1), '#'.repeat(16))
    assert.equal(positions(level, '^').length, 1)
    assert.equal(positions(level, 's').length, 2)
    assert.equal(positions(level, 'E').length, 1)
    assert.equal(positions(level, '*').length, 1)
    assert.equal(positions(level, 'P').length, positions(level, 'Q').length)
    for (const key of ['a', 'b'])
      assert.equal(positions(level, key).length, positions(level, key.toUpperCase()).length)
  }
})

for (const fixture of routes) {
  const level = levels[fixture.n - 1]
  for (const kind of ['route', 'bonus', 'alternate'] as const) {
    const path = kind in fixture ? fixture[kind as keyof typeof fixture] : undefined
    if (!Array.isArray(path)) continue
    test(`${level.name}: ${kind} completes under the real movement, growth and portal rules`, () => {
      let state = createState(level)
      let sawPortal = false
      for (const coordinate of path as readonly (readonly [number, number])[]) {
        const head = state.snake[0]
        const dx = coordinate[0] - head.x
        const dy = coordinate[1] - head.y
        assert.notEqual(dx === 0, dy === 0)
        const direction: Direction = dx ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP'
        for (let i = 0; i < Math.abs(dx) + Math.abs(dy); i++) {
          assert.equal(state.status, 'playing')
          const before = state.snake[0]
          state = step(level, state, direction)
          assert.notEqual(
            state.status,
            'lost',
            `${kind}: ${state.message} near ${JSON.stringify(before)}`,
          )
          const after = state.snake[0]
          sawPortal ||= Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 1
        }
      }
      assert.equal(state.status, 'won')
      assert.equal(state.apples.length, 0)
      assert.equal(state.snake.length, 3 + positions(level, 'o').length)
      assert.deepEqual(state.snake[0], positions(level, 'E')[0])
      assert.equal(state.gem, kind === 'bonus')
      if (kind === 'alternate') assert.equal(sawPortal, false)
    })
  }
}

test('queued corners reject reversals, allow two turns, and do not mutate the pending queue', () => {
  assert.deepEqual(queueDirection('UP', [], 'DOWN'), [])
  const first = queueDirection('UP', [], 'RIGHT')
  const second = queueDirection('UP', first, 'DOWN')
  assert.deepEqual(first, ['RIGHT'])
  assert.deepEqual(second, ['RIGHT', 'DOWN'])
  assert.deepEqual(queueDirection('UP', first, 'LEFT'), first)
  assert.deepEqual(queueDirection('UP', second, 'LEFT'), second)
})

test('keys open only the corresponding door without growth; closed doors stop the snake', () => {
  const level = levels[5]
  const initial = createState(level)
  const key = step(level, {
    ...initial,
    snake: [
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 3, y: 6 },
    ],
  })
  assert.deepEqual(key.keys, ['a'])
  assert.equal(key.snake.length, 3)
  const atDoor: SnakeState = {
    ...initial,
    direction: 'RIGHT',
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
  }
  assert.equal(step(level, atDoor).status, 'lost')
  assert.equal(step(level, { ...atDoor, keys: key.keys }).status, 'playing')
  const atB: SnakeState = {
    ...atDoor,
    keys: key.keys,
    snake: [
      { x: 9, y: 5 },
      { x: 8, y: 5 },
      { x: 7, y: 5 },
    ],
  }
  assert.equal(step(level, atB).status, 'lost')
})

test('portal preserves actual direction, triggers once, and checks exit body occupancy', () => {
  const level = levels[6]
  const source: SnakeState = {
    ...createState(level),
    snake: [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 5, y: 7 },
    ],
  }
  const teleported = step(level, source)
  assert.deepEqual(teleported.snake[0], { x: 10, y: 7 })
  assert.equal(teleported.direction, 'UP')
  assert.deepEqual(step(level, teleported, 'DOWN').snake[0], { x: 10, y: 6 })
  assert.deepEqual(step(level, teleported, 'LEFT').snake[0], { x: 9, y: 7 })
  assert.equal(step(level, { ...source, snake: [...source.snake, { x: 10, y: 7 }] }).status, 'lost')
  const returning: SnakeState = {
    ...source,
    direction: 'LEFT',
    snake: [
      { x: 11, y: 7 },
      { x: 12, y: 7 },
      { x: 13, y: 7 },
    ],
  }
  assert.deepEqual(step(level, returning).snake[0], { x: 5, y: 4 })
})

test('gem is optional and does not grow; exit requires every apple; terminal ticks do nothing', () => {
  const level = levels[0]
  const state = createState(level)
  const withGem = step(level, {
    ...state,
    direction: 'RIGHT',
    snake: [
      { x: 11, y: 9 },
      { x: 10, y: 9 },
      { x: 9, y: 9 },
    ],
  })
  assert.equal(withGem.gem, true)
  assert.equal(withGem.snake.length, 3)
  const atExit: SnakeState = {
    ...state,
    direction: 'RIGHT',
    snake: [
      { x: 12, y: 2 },
      { x: 11, y: 2 },
      { x: 10, y: 2 },
    ],
  }
  assert.equal(step(level, atExit).status, 'playing')
  const won = step(level, { ...atExit, apples: [] })
  assert.equal(won.status, 'won')
  assert.equal(won.gem, false)
  assert.equal(step(level, won), won)
  const retry = createState(level)
  assert.equal(retry.gem, false)
  assert.equal(retry.moves, 0)
  assert.equal(retry.apples.length, 3)
  assert.deepEqual(retry.keys, [])
})

test('walls and the currently occupied tail are collisions, without consuming any apple', () => {
  const level = levels[0]
  const state = createState(level)
  const wall = step(level, {
    ...state,
    snake: [
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
    ],
  })
  assert.equal(wall.status, 'lost')
  assert.equal(wall.apples.length, state.apples.length)
  assert.equal(step(level, wall), wall)
  const body = step(
    level,
    {
      ...state,
      direction: 'RIGHT',
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
      ],
    },
    'UP',
  )
  assert.equal(body.status, 'lost')
})

test('completion unlocks sequentially, preserves gems and best moves, and isolates players and classic data', () => {
  hydratePlayerFile(playerFixture('snake-a'))
  hydratePlayerFile(playerFixture('snake-b'))
  stageProgress('snake', 'snake-a', { classicScore: 100 })
  const first = recordCompletion({}, levels[0].id, 26, true)
  const replay = recordCompletion(first, levels[0].id, 22, false)
  assert.deepEqual(replay[levels[0].id], { medal: 2, bestMoves: 22 })
  assert.equal(unlockedLevel({}), 0)
  assert.equal(unlockedLevel(replay), 1)
  assert.equal(unlockedLevel({ [levels[8].id]: { medal: 1, bestMoves: 32 } }), 0)
  saveProgress('snake', 'snake-a', replay)
  saveProgress('snake', 'snake-a', recordCompletion({}, levels[0].id, 40, false))
  assert.deepEqual(readProgress('snake', 'snake-a'), replay)
  assert.deepEqual(readProgress('snake', 'snake-b'), {})
  assert.deepEqual(readProgress('snake'), {})
  assert.equal(readPlayerProgress('snake', 'snake-a').classicScore, 100)
  saveProgress('snake', undefined, replay)
  assert.deepEqual(readProgress('snake'), replay)
  assert.deepEqual(readProgress('snake', 'snake-b'), {})
  let all = replay
  for (const level of levels) all = recordCompletion(all, level.id, 50, false)
  assert.equal(unlockedLevel(all), 8)
})

test('level result survives the real player-file settlement and reload', async () => {
  await withPlayerServer(async () => {
    const user = await createUser('蛇关卡测试')
    await loadPlayerFile(user.id)
    const progress = recordCompletion({}, levels[0].id, 26, true)
    saveProgress('snake', user.id, progress)
    const record = await createRecord(user.id, {
      gameId: 'snake',
      result: 'win',
      level: 1,
      score: 30,
      duration: 8,
    })
    const file = await loadPlayerFile(user.id)
    assert.deepEqual(readProgress('snake', user.id), progress)
    assert.equal(file.games.snake.records.length, 1)
    assert.equal(file.games.snake.records[0].id, record.id)
    assert.equal(file.games.snake.records[0].level, 1)
    assert.equal(file.games.snake.records[0].result, 'win')
  })
})
