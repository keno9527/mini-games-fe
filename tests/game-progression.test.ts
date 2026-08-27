import test from 'node:test'
import assert from 'node:assert/strict'

import { getGameProgression, saveGameProgression } from '../src/games/gravity-graveyard/progression.ts'

const values = new Map<string, string>()

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  },
})

test('game progression stays isolated by game id and is deduplicated', () => {
  saveGameProgression('gravity-graveyard', {
    liturgies: ['twin-choir', 'twin-choir'],
    tools: ['funeral-anchor'],
    ships: ['ivory-coffin'],
  })

  assert.deepEqual(getGameProgression('gravity-graveyard'), {
    liturgies: ['twin-choir'],
    tools: ['funeral-anchor'],
    ships: ['ivory-coffin'],
  })
  assert.deepEqual(getGameProgression('another-game'), {
    liturgies: [],
    tools: [],
    ships: [],
  })
})

test('malformed progression data falls back safely', () => {
  values.set('mini-games-local-progression:gravity-graveyard', '{broken')

  assert.deepEqual(getGameProgression('gravity-graveyard'), {
    liturgies: [],
    tools: [],
    ships: [],
  })
})
