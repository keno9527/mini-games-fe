import test from 'node:test'
import assert from 'node:assert/strict'
import { LevelSettlement } from '../src/games/breakout/settlement.ts'
import { LEVEL_LAYOUTS } from '../src/games/breakout/levels.ts'
import { createUser, createRecord, getRecords, getPlayRanking } from '../src/api/index.ts'
import { loadPlayerFile, stageProgress } from '../src/api/playerFiles.ts'
import { withPlayerServer } from './helpers/player-server.ts'

const total = LEVEL_LAYOUTS.length

test('each cleared or failed level contributes only its own score and active time', async () => {
  await withPlayerServer(async () => {
    const player = await createUser('打砖块逐关结算')
    await loadPlayerFile(player.id)
    const attempt = new LevelSettlement()
    attempt.begin(0)
    const first = attempt.finish('win', 700, 600, total)!
    assert.equal(first.level, 1)
    assert.deepEqual(first.progress, { highestUnlockedLevel: 2, lastPlayedLevel: 2 })
    assert.equal(attempt.finish('win', 700, 600, total), null)
    const { progress, ...record } = first
    stageProgress('breakout', player.id, progress)
    const pendingFirst = createRecord(player.id, { gameId: 'breakout', ...record })
    // Advancing before the first write resolves must not change its snapshot.
    attempt.begin(1, 700, 600)
    const second = attempt.finish('lose', 850, 900, total)!
    assert.equal(second.score, 150)
    assert.equal(second.duration, 5)
    assert.equal(second.level, 2)
    assert.equal(second.progress.lastPlayedLevel, 2)
    assert.equal(attempt.finish('lose', 850, 900, total), null)
    const { progress: nextProgress, ...nextRecord } = second
    stageProgress('breakout', player.id, nextProgress)
    await Promise.all([
      pendingFirst,
      createRecord(player.id, { gameId: 'breakout', ...nextRecord }),
    ])
    const records = await getRecords(player.id)
    assert.equal(records.length, 2)
    assert.equal(
      records.reduce((sum, r) => sum + r.score, 0),
      850,
    )
    assert.equal(
      records.reduce((sum, r) => sum + r.duration, 0),
      15,
    )
    const ranking = (await getPlayRanking()).find((r) => r.gameId === 'breakout')!
    assert.equal(ranking.playCount, 2)
    assert.equal(ranking.totalDuration, 15)
    assert.equal((await loadPlayerFile(player.id)).games.breakout.progress.lastPlayedLevel, 2)
  })
})

test('last-level victory stays in bounds; restarting allows a fresh attempt', () => {
  const attempt = new LevelSettlement()
  attempt.begin(total - 1, 1000, 1200)
  const final = attempt.finish('win', 1600, 1800, total)!
  assert.equal(final.score, 600)
  assert.equal(final.duration, 10)
  assert.equal(final.progress.lastPlayedLevel, total)
  assert.equal(final.progress.highestUnlockedLevel, total)
  attempt.begin(total - 1)
  const retry = attempt.finish('lose', 100, 120, total)!
  assert.equal(retry.score, 100)
  assert.equal(retry.duration, 2)
  assert.equal(retry.result, 'lose')
})
