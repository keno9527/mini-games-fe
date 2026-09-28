import test from 'node:test'
import assert from 'node:assert/strict'
import { withPlayerServer } from './helpers/player-server'
import {
  fileRequest,
  hydratePlayerFile,
  loadPlayerFile,
  commitSettlement,
  readPlayerProgress,
} from '../src/api/playerFiles'
import type { PlayerFile } from '../src/features/players/schema'
import {
  readLogicProgress,
  saveLogicProgress,
  resumeLogicLevel,
} from '../src/games/minesweeper/progression'
import { completeLevel } from '../src/games/minesweeper/logic'

test('logic completions persist with settlement, survive reload, and isolate players', async () => {
  await withPlayerServer(async () => {
    const a = hydratePlayerFile(await fileRequest<PlayerFile>('', 'POST', { name: '扫雷测试甲' }))
    const b = hydratePlayerFile(await fileRequest<PlayerFile>('', 'POST', { name: '扫雷测试乙' }))
    const id = a.player.id
    saveLogicProgress('minesweeper', id, completeLevel({}, 1, true))
    await commitSettlement({
      record: {
        id: crypto.randomUUID(),
        userId: id,
        gameId: 'minesweeper',
        level: 1,
        score: 0,
        result: 'win',
        duration: 12,
        playedAt: new Date().toISOString(),
      },
      progress: readPlayerProgress('minesweeper', id),
    })
    hydratePlayerFile(a) // discard the in-memory progress to require a real file read
    await loadPlayerFile(id)
    assert.deepEqual(readLogicProgress('minesweeper', id), {
      1: { completed: true, unaided: true },
    })
    assert.equal(resumeLogicLevel(readLogicProgress('minesweeper', id)), 2)
    assert.deepEqual(readLogicProgress('minesweeper', b.player.id), {})
    saveLogicProgress('minesweeper', id, completeLevel({}, 1, false))
    assert.equal(readLogicProgress('minesweeper', id)[1].unaided, true)
    const file = await fileRequest<PlayerFile>(`/${id}`)
    assert.equal(file.games.minesweeper.records[0].level, 1)
  })
})

test('legacy local achievements are retained alongside file progress', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) =>
        key.endsWith(':legacy-user')
          ? '{"1":{"completed":true,"unaided":true},"5":{"completed":true,"unaided":false}}'
          : null,
    },
  })
  try {
    const progress = readLogicProgress('minesweeper', 'legacy-user')
    assert.equal(progress[1].unaided, true)
    assert.equal(progress[5].completed, true)
    assert.equal(resumeLogicLevel(progress), 2)
    assert.deepEqual(readLogicProgress('minesweeper', 'another-user'), {})
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
