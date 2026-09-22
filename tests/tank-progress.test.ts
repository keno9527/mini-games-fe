import test from 'node:test'
import assert from 'node:assert/strict'
import { loadProgress, saveProgress } from '../src/games/tank-battle/progress.ts'
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
