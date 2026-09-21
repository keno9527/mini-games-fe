import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GamePlayTracker,
  comparePlayTotals,
  type PlayTotals,
} from '../src/features/games/playStats.ts'
import { addGamePlayStats, createRecord, deleteUser, getPlayRanking } from '../src/api/index.ts'

function session() {
  let clock = 0
  const totals: PlayTotals = { playCount: 0, totalDuration: 0 }
  const tracker = new GamePlayTracker(
    (delta) => {
      totals.playCount += delta.playCount
      totals.totalDuration += delta.totalDuration
    },
    () => clock,
  )
  return {
    tracker,
    totals,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

test('opening and leaving a game without starting contributes nothing', () => {
  const { tracker, totals, advance } = session()
  advance(10_000)
  tracker.flush()
  tracker.setVisible(false)
  tracker.setVisible(true)
  tracker.stop()
  assert.deepEqual(totals, { playCount: 0, totalDuration: 0 })
})

test('counts starts without needing a user or completed score, and retains abandoned time', () => {
  const { tracker, totals, advance } = session()
  tracker.start()
  tracker.start()
  advance(12_500)
  tracker.flush()
  advance(2_500)
  tracker.stop()
  tracker.stop()
  assert.deepEqual(totals, { playCount: 1, totalDuration: 15 })
  tracker.start()
  advance(1_000)
  tracker.restart()
  advance(2_000)
  tracker.stop()
  assert.deepEqual(totals, { playCount: 3, totalDuration: 18 })
})

test('pause and hidden time are excluded; resuming does not count another round', () => {
  const { tracker, totals, advance } = session()
  tracker.start()
  advance(1_000)
  tracker.setState('paused')
  advance(60_000)
  tracker.setVisible(false)
  advance(60_000)
  tracker.setVisible(true)
  advance(60_000)
  tracker.start()
  advance(2_000)
  tracker.setVisible(false)
  advance(60_000)
  tracker.flush()
  tracker.setVisible(true)
  advance(3_000)
  tracker.stop()
  advance(60_000)
  tracker.flush()
  assert.deepEqual(totals, { playCount: 1, totalDuration: 6 })
})

test('starting while hidden counts a round but only measures visible play', () => {
  const { tracker, totals, advance } = session()
  tracker.setVisible(false)
  tracker.start()
  advance(60_000)
  tracker.setVisible(true)
  advance(1_000)
  tracker.stop()
  assert.deepEqual(totals, { playCount: 1, totalDuration: 1 })
})

test('ranking sorts by rounds first and duration only on a tie', () => {
  const ranked = [
    { playCount: 2, totalDuration: 100 },
    { playCount: 1, totalDuration: 9999 },
    { playCount: 2, totalDuration: 200 },
    { playCount: 3, totalDuration: 0 },
  ].sort(comparePlayTotals)
  assert.deepEqual(
    ranked.map((item) => item.totalDuration),
    [0, 200, 100, 9999],
  )
})

test('local totals persist across reads, need no player, and ignore scores and seed rankings', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  })
  try {
    assert.deepEqual(await getPlayRanking(), [])
    addGamePlayStats('snake', { playCount: 2, totalDuration: 10 })
    addGamePlayStats('memory', { playCount: 1, totalDuration: 999 })
    addGamePlayStats('tetris', { playCount: 2, totalDuration: 20 })
    addGamePlayStats('snake', { playCount: 0, totalDuration: 5 })
    const ranking = await getPlayRanking()
    assert.deepEqual(
      ranking.map(({ gameId, playCount, totalDuration }) => [gameId, playCount, totalDuration]),
      [
        ['tetris', 2, 20],
        ['snake', 2, 15],
        ['memory', 1, 999],
      ],
    )
    assert.deepEqual(await getPlayRanking(), ranking)

    storage.set('mini-games-local-users', JSON.stringify([{ id: 'player', name: '玩家' }]))
    await createRecord('player', { gameId: 'snake', score: 9999, duration: 10, result: 'win' })
    assert.deepEqual(await getPlayRanking(), ranking)
    await deleteUser('player')
    assert.deepEqual(await getPlayRanking(), ranking)

    addGamePlayStats('unknown', { playCount: 100, totalDuration: 100 })
    addGamePlayStats('snake', { playCount: -1, totalDuration: 0 })
    addGamePlayStats('snake', { playCount: 0.5, totalDuration: 0 })
    addGamePlayStats('snake', { playCount: 1, totalDuration: NaN })
    addGamePlayStats('snake', { playCount: 1, totalDuration: Infinity })
    addGamePlayStats('snake', { playCount: 1, totalDuration: -1 })
    assert.deepEqual(await getPlayRanking(), ranking)
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})

test('invalid or unavailable browser storage never crashes gameplay', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  let stored = '{broken json'
  let blocked = false
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => {
          if (blocked) throw new Error('blocked')
          return stored
        },
        setItem: (_key: string, value: string) => {
          if (blocked) throw new Error('blocked')
          stored = value
        },
      },
    },
  })
  try {
    for (const invalid of [
      '{broken json',
      'null',
      '[]',
      '42',
      '{"snake":{"playCount":-1,"totalDuration":2}}',
    ]) {
      stored = invalid
      assert.deepEqual(await getPlayRanking(), [])
      addGamePlayStats('snake', { playCount: 1, totalDuration: 3 })
      assert.equal((await getPlayRanking())[0].playCount, 1)
    }
    blocked = true
    assert.doesNotThrow(() => addGamePlayStats('snake', { playCount: 1, totalDuration: 3 }))
    assert.deepEqual(await getPlayRanking(), [])
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
