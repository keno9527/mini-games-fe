import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GamePlayTracker,
  comparePlayTotals,
  type PlayTotals,
} from '../src/features/games/playStats.ts'
import { createUser, createRecord, deleteUser, getPlayRanking } from '../src/api/index.ts'
import { loadPlayerFile } from '../src/api/playerFiles.ts'
import { withPlayerServer } from './helpers/player-server.ts'

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

test('ranking derives from settled player files and excludes archived players', async () => {
  await withPlayerServer(async () => {
    assert.deepEqual(await getPlayRanking(), [])
    const first = await createUser('排名甲')
    const second = await createUser('排名乙')
    await loadPlayerFile(first.id)
    await loadPlayerFile(second.id)
    for (const user of [first, second])
      await createRecord(user.id, { gameId: 'snake', score: 100, duration: 10, result: 'lose' })
    await createRecord(first.id, { gameId: 'memory', score: 1, duration: 999, result: 'win' })
    assert.deepEqual(
      (await getPlayRanking()).map(({ gameId, playCount, totalDuration }) => [
        gameId,
        playCount,
        totalDuration,
      ]),
      [
        ['snake', 2, 20],
        ['memory', 1, 999],
      ],
    )
    await deleteUser(second.id)
    assert.equal((await getPlayRanking()).find((r) => r.gameId === 'snake')?.playCount, 1)
  })
})
