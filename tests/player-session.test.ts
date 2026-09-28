import test from 'node:test'
import assert from 'node:assert/strict'
import { useUserStore } from '../src/store/userStore.ts'
import { createUser, deleteUser } from '../src/api/index.ts'
import { readPlayerProgress } from '../src/api/playerFiles.ts'
import { createPlayerRepository } from '../scripts/player-data.ts'
import { withPlayerServer } from './helpers/player-server.ts'

test('restore last player hydrates progress, deduplicates initialization, and allows manual switching', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  })
  const reset = () =>
    useUserStore.setState({ currentUser: null, restoreStatus: 'idle', restoreError: '' })
  try {
    await withPlayerServer(async (directory) => {
      const player = await createUser('记住玩家')
      const repo = createPlayerRepository(directory)
      await repo.settle(player.id, {
        record: {
          id: 'session-round',
          userId: player.id,
          gameId: 'xiangqi',
          score: 300,
          duration: 5,
          result: 'win',
          playedAt: new Date().toISOString(),
        },
        progress: { 'rook-ladder': 3 },
      })
      useUserStore.getState().setCurrentUser(player)
      reset()
      await Promise.all([
        useUserStore.getState().restoreLastPlayer(),
        useUserStore.getState().restoreLastPlayer(),
      ])
      assert.equal(useUserStore.getState().currentUser?.id, player.id)
      assert.deepEqual(readPlayerProgress('xiangqi', player.id), { 'rook-ladder': 3 })
      useUserStore.getState().setCurrentUser(null)
      await useUserStore.getState().restoreLastPlayer()
      assert.equal(useUserStore.getState().currentUser, null)
      reset()
      const restoring = useUserStore.getState().restoreLastPlayer()
      useUserStore.getState().setCurrentUser(null)
      await restoring
      assert.equal(useUserStore.getState().currentUser, null)
      await deleteUser(player.id)
      reset()
      await useUserStore.getState().restoreLastPlayer()
      assert.equal(useUserStore.getState().currentUser, null)
      assert.match(useUserStore.getState().restoreError, /归档/)
      values.set('mini-games-last-player', 'missing-player')
      reset()
      await useUserStore.getState().restoreLastPlayer()
      assert.equal(useUserStore.getState().currentUser, null)
      assert.equal(useUserStore.getState().restoreStatus, 'ready')
      assert.match(useUserStore.getState().restoreError, /不存在/)
      values.clear()
      reset()
      await useUserStore.getState().restoreLastPlayer()
      assert.equal(useUserStore.getState().restoreError, '')
      assert.equal(useUserStore.getState().restoreStatus, 'ready')
    })
  } finally {
    reset()
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
