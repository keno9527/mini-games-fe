import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getGameProgression,
  saveGameProgression,
} from '../src/games/gravity-graveyard/progression.ts'
import { hydratePlayerFile } from '../src/api/playerFiles.ts'
import { playerFixture } from './helpers/player-server.ts'

test('progress is staged per player and game, with deduplicated unlocks', () => {
  hydratePlayerFile(playerFixture('gravity-a'))
  hydratePlayerFile(playerFixture('gravity-b'))
  const progress = {
    liturgies: ['twin-choir', 'twin-choir'],
    tools: ['funeral-anchor'],
    ships: ['ivory-coffin'],
  }
  saveGameProgression('gravity-graveyard', progress, 'gravity-a')
  assert.deepEqual(getGameProgression('gravity-graveyard', 'gravity-a'), {
    ...progress,
    liturgies: ['twin-choir'],
  })
  const empty = { liturgies: [], tools: [], ships: [] }
  assert.deepEqual(getGameProgression('gravity-graveyard', 'gravity-b'), empty)
  assert.deepEqual(getGameProgression('another-game', 'gravity-a'), empty)
  assert.deepEqual(getGameProgression('gravity-graveyard'), empty)
  saveGameProgression('gravity-graveyard', progress)
  assert.deepEqual(getGameProgression('gravity-graveyard'), {
    ...progress,
    liturgies: ['twin-choir'],
  })
  assert.deepEqual(getGameProgression('gravity-graveyard', 'gravity-b'), empty)
  assert.deepEqual(getGameProgression('another-game'), empty)
  assert.throws(() => saveGameProgression('gravity-graveyard', progress, 'missing-player'), /选择/)
})
