import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createPlayerRepository } from '../scripts/player-data.ts'
import { createUser, createRecord } from '../src/api/index.ts'
import { loadPlayerFile, stageProgress, getSaveState, retrySaves } from '../src/api/playerFiles.ts'
import { withPlayerServer } from './helpers/player-server.ts'

const settlement = (userId: string, id: string, level = 3) => ({
  record: {
    id,
    userId,
    gameId: 'snake',
    score: 10,
    duration: 5,
    result: 'lose',
    playedAt: '2026-09-28T00:00:00Z',
  },
  progress: { highestUnlockedLevel: level },
})

test('staging never writes; settlement writes only the selected player and survives reload', async () => {
  await withPlayerServer(async (directory) => {
    const a = await createUser('玩家甲')
    const b = await createUser('玩家乙')
    await loadPlayerFile(a.id)
    await loadPlayerFile(b.id)
    const path = join(directory, `${a.id}.json`)
    const before = await readFile(path, 'utf8')
    stageProgress('snake', a.id, { highestUnlockedLevel: 4 })
    assert.equal(await readFile(path, 'utf8'), before)
    await createRecord(a.id, { gameId: 'snake', score: 10, duration: 5, result: 'lose' })
    const saved = await loadPlayerFile(a.id)
    assert.equal(saved.games.snake.progress.highestUnlockedLevel, 4)
    assert.equal(saved.games.snake.records.length, 1)
    assert.deepEqual((await loadPlayerFile(b.id)).games, {})
    assert.throws(() => stageProgress('snake', undefined, {}), /选择/)
    await assert.rejects(() => createUser('玩家甲'), /同名/)
  })
})

test('serialized settlements retain all rounds, deduplicate retries, reject ownership/collisions', async () => {
  await withPlayerServer(async (directory) => {
    const repo = createPlayerRepository(directory)
    const file = await repo.create({ name: '并发' })
    const id = file.player.id
    await Promise.all([
      repo.settle(id, settlement(id, 'round-a', 5)),
      repo.settle(id, settlement(id, 'round-b', 2)),
    ])
    await repo.settle(id, settlement(id, 'round-a', 5))
    const saved = await repo.read(id)
    assert.equal(saved.games.snake.records.length, 2)
    assert.equal(saved.games.snake.progress.highestUnlockedLevel, 5)
    await assert.rejects(() => repo.settle(id, settlement('someone-else', 'round-c')), /不属于/)
    const collision = settlement(id, 'round-a')
    collision.record.score = 99
    await assert.rejects(() => repo.settle(id, collision), /不一致/)
    await assert.rejects(() => repo.read('../escape'), /无效/)
    await repo.archive(id)
    assert.equal((await repo.read(id)).games.snake.records.length, 2)
    await assert.rejects(() => repo.settle(id, settlement(id, 'round-c')), /归档/)
  })
})

test('a lost response retries the same settlement without duplicating the saved round', async () => {
  await withPlayerServer(async (directory) => {
    const player = await createUser('重试')
    await loadPlayerFile(player.id)
    const original = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const response = await original(input, init)
      if (String(input).endsWith('/settlements')) throw new Error('response lost after write')
      return response
    }
    try {
      await assert.rejects(() =>
        createRecord(player.id, { gameId: 'snake', score: 5, duration: 8, result: 'lose' }),
      )
      assert.equal(getSaveState().pending, 1)
    } finally {
      globalThis.fetch = original
    }
    await retrySaves()
    assert.equal(getSaveState().pending, 0)
    assert.equal(
      JSON.parse(await readFile(join(directory, `${player.id}.json`), 'utf8')).games.snake.records
        .length,
      1,
    )
  })
})

test('migration keeps stable identity, merges best progress once, and preserves corrupt files', async () => {
  await withPlayerServer(async (directory) => {
    const repo = createPlayerRepository(directory)
    const file = await repo.create({ name: '迁移' })
    const id = file.player.id
    await repo.settle(id, settlement(id, 'existing', 8))
    const incoming = {
      ...file,
      games: {
        snake: {
          progress: { highestUnlockedLevel: 3 },
          records: [settlement(id, 'legacy').record],
        },
      },
    }
    await repo.import(incoming)
    await repo.import(incoming)
    assert.equal((await repo.read(id)).games.snake.records.length, 2)
    assert.equal((await repo.read(id)).games.snake.progress.highestUnlockedLevel, 8)
    assert.equal((await repo.read(id)).guestImported, undefined)
    await repo.import(
      { ...file, games: { snake: { progress: { highestUnlockedLevel: 9 }, records: [] } } },
      true,
    )
    assert.equal((await repo.read(id)).games.snake.progress.highestUnlockedLevel, 9)
    const path = join(directory, `${id}.json`)
    await writeFile(path, '{broken')
    await assert.rejects(() => repo.settle(id, settlement(id, 'new')), /原文件已保留/)
    assert.equal(await readFile(path, 'utf8'), '{broken')
  })
})

test('file endpoints reject cross-origin writes and non-JSON input', async () => {
  await withPlayerServer(async () => {
    const cross = await fetch('/__player-data/players', {
      method: 'POST',
      headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'cross' }),
    })
    assert.equal(cross.status, 403)
    const text = await fetch('/__player-data/players', { method: 'POST', body: 'name=bad' })
    assert.equal(text.status, 415)
    assert.deepEqual(await (await fetch('/__player-data/players')).json(), [])
  })
})

test('legacy browser migration preserves IDs, isolates guest progress, and leaves the source intact', async () => {
  const { legacyUsers, legacyFile, importLegacyPlayer, importGuestProgress } =
    await import('../src/features/players/migration.ts')
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const user = {
    id: 'legacy-user',
    name: '旧玩家',
    avatar: 'default',
    createdAt: '2026-09-01T00:00:00Z',
  }
  const values = new Map<string, string>([
    ['mini-games-local-users', JSON.stringify([user])],
    ['mini-games-local-records', JSON.stringify([settlement(user.id, 'old-round').record])],
    ['mini-games-tank-progress-v1:user:legacy-user', '4'],
    ['mini-games-tank-progress-v1:coop:tank-a:user:legacy-user', '7'],
    ['mini-games-tank-progress-v1:guest', '12'],
    [
      'mini-games-local-progression:gravity-graveyard',
      JSON.stringify({ liturgies: ['twin-choir'], tools: [], ships: [] }),
    ],
  ])
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  try {
    assert.deepEqual(legacyUsers(), [user])
    assert.deepEqual(legacyFile(user).games['tank-battle'].progress, {
      'battle-city': { single: 4 },
      'tank-a': { coop: 7 },
    })
    assert.equal(legacyFile(user).games['gravity-graveyard'], undefined)
    await withPlayerServer(async (directory) => {
      await importLegacyPlayer(user)
      const repo = createPlayerRepository(directory)
      assert.equal((await repo.read(user.id)).games.snake.records[0].id, 'old-round')
      await importGuestProgress(user)
      const saved = await repo.read(user.id)
      assert.deepEqual(saved.games['tank-battle'].progress['battle-city'], { single: 12 })
      assert.deepEqual(saved.games['gravity-graveyard'].progress.liturgies, ['twin-choir'])
      assert.equal(values.get('mini-games-tank-progress-v1:guest'), '12')
    })
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
