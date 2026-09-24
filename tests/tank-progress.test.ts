import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadProgress,
  saveProgress,
  loadSelectedCampaign,
  saveSelectedCampaign,
} from '../src/games/tank-battle/progress.ts'
import { LEVELS } from '../src/games/tank-battle/data/levels.ts'

test('progress survives reloads, keeps the furthest stage, and isolates players and guests', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  assert.equal(loadProgress('p1', storage), 0)
  saveProgress(4, 'p1', storage)
  saveProgress(0, 'p1', storage)
  assert.equal(loadProgress('p1', storage), 4)
  assert.equal(loadProgress('p2', storage), 0)
  assert.equal(loadProgress(undefined, storage), 0)
  saveProgress(8, undefined, storage)
  assert.equal(loadProgress(undefined, storage), 8)
  assert.equal(loadProgress('p1', storage), 4)
  saveProgress(LEVELS.length - 1, 'p1', storage)
  assert.equal(loadProgress('p1', storage), LEVELS.length - 1)
})

test('invalid progress is rejected and recoverable; unavailable storage reports failure', () => {
  let raw = 'bad json'
  const storage = {
    getItem: () => raw,
    setItem: (_: string, value: string) => {
      raw = value
    },
  }
  for (const value of ['bad json', '-1', '1.5', 'null', '"4"', String(LEVELS.length)]) {
    raw = value
    assert.throws(() => loadProgress(undefined, storage))
  }
  saveProgress(3, undefined, storage)
  assert.equal(loadProgress(undefined, storage), 3)
  assert.throws(() => saveProgress(Number.NaN, undefined, storage))
  const unavailable = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('denied')
    },
  }
  assert.throws(() => loadProgress(undefined, unavailable))
  assert.throws(() => saveProgress(4, undefined, unavailable))
})

test('coop progress is isolated by campaign and player without changing existing solo saves', () => {
  const values = new Map([
    ['mini-games-tank-progress-v1:user:p1', '4'],
    ['mini-games-tank-progress-v1:tank-a:user:p1', '12'],
  ])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  for (const campaign of ['battle-city', 'tank-a'] as const) {
    assert.equal(loadProgress('p1', storage, campaign, 'coop'), 0)
  }
  saveProgress(8, 'p1', storage, 'tank-a', 'coop')
  saveProgress(0, 'p1', storage, 'tank-a', 'coop')
  assert.equal(loadProgress('p1', storage, 'tank-a', 'coop'), 8)
  assert.equal(loadProgress('p1', storage, 'tank-a'), 12)
  assert.equal(loadProgress('p1', storage), 4)
  assert.equal(loadProgress('p1', storage, 'battle-city', 'coop'), 0)
  assert.equal(loadProgress('p2', storage, 'tank-a', 'coop'), 0)
  assert.equal(loadProgress(undefined, storage, 'tank-a', 'coop'), 0)
  saveProgress(49, undefined, storage, 'tank-a', 'coop')
  assert.equal(loadProgress(undefined, storage, 'tank-a', 'coop'), 49)
  assert.equal(loadProgress('p1', storage, 'tank-a', 'coop'), 8)
  assert.equal(loadProgress(undefined, storage, 'tank-a'), 0)
  assert.throws(() => saveProgress(50, undefined, storage, 'tank-a', 'coop'))
})

test('selected campaign survives reloads and falls back safely when storage is invalid or blocked', () => {
  let value: string | null = null
  const storage = {
    getItem: () => value,
    setItem: (_: string, next: string) => {
      value = next
    },
  }
  assert.equal(loadSelectedCampaign(storage), 'battle-city')
  saveSelectedCampaign('tank-a', storage)
  assert.equal(loadSelectedCampaign(storage), 'tank-a')
  saveSelectedCampaign('battle-city', storage)
  assert.equal(loadSelectedCampaign(storage), 'battle-city')
  value = 'unknown'
  assert.equal(loadSelectedCampaign(storage), 'battle-city')
  const blocked = {
    getItem: (): never => {
      throw new Error('denied')
    },
    setItem: (): never => {
      throw new Error('denied')
    },
  }
  assert.equal(loadSelectedCampaign(blocked), 'battle-city')
  assert.doesNotThrow(() => saveSelectedCampaign('tank-a', blocked))
})
