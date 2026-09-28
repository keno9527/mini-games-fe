import test from 'node:test'
import assert from 'node:assert/strict'
import { LEVEL_LAYOUTS } from '../src/games/breakout/levels.ts'
import {
  CUSTOM_LEVEL_KEY,
  EDITOR_COLS,
  EDITOR_ROWS,
  breakableCount,
  createLevel,
  loadLevel,
  paintLine,
  parseLevel,
  playableLevel,
  saveLevel,
} from '../src/games/breakout/editor.ts'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

test('every classic layout becomes an editable copy without changing the built-in level', () => {
  const original = JSON.stringify(LEVEL_LAYOUTS)
  for (let index = 0; index < LEVEL_LAYOUTS.length; index++) {
    const level = createLevel(index)
    assert.equal(level.layout.length, EDITOR_ROWS)
    assert.ok(level.layout.every((row) => row.length === EDITOR_COLS))
    assert.deepEqual(level.layout.slice(0, LEVEL_LAYOUTS[index].length), LEVEL_LAYOUTS[index])
    assert.ok(breakableCount(playableLevel(level).layout) > 0)
    level.layout[0] = 'X'.repeat(EDITOR_COLS)
  }
  assert.equal(JSON.stringify(LEVEL_LAYOUTS), original)
})

test('fast drags paint intermediate cells in both directions and keep the original immutable', () => {
  const blank = createLevel().layout
  const row = paintLine(blank, [0, 0], [11, 0], 'H')
  assert.equal(row[0], 'H'.repeat(12))
  assert.equal(blank[0], '.'.repeat(12))
  assert.equal(paintLine(row, [11, 0], [0, 0], '.')[0], blank[0])
  const diagonal = paintLine(blank, [0, 0], [9, 9], 'X')
  for (let i = 0; i < 10; i++) assert.equal(diagonal[i][i], 'X')
  assert.equal(paintLine(blank, [-1, 0], [12, 0], '#')[0], '#'.repeat(12))
})

test('empty and steel-only drafts can be saved but cannot be played', () => {
  const store = storage()
  const blank = createLevel()
  assert.deepEqual(saveLevel(blank, store), blank)
  assert.throws(() => playableLevel(blank), /至少放置/)
  const steel = { ...blank, layout: paintLine(blank.layout, [0, 0], [11, 0], '#') }
  assert.equal(breakableCount(steel.layout), 0)
  assert.throws(() => playableLevel(steel), /至少放置/)
  for (const tile of ['1', 'H', 'X'] as const) {
    const valid = { ...steel, layout: paintLine(steel.layout, [5, 5], [5, 5], tile) }
    assert.equal(breakableCount(playableLevel(valid).layout), 1)
  }
})

test('local save round trip and playable snapshots never share mutable layout arrays', () => {
  const store = storage()
  assert.equal(loadLevel(store), null)
  const draft = { ...createLevel(1), name: '  自定义测试关卡  ' }
  const saved = saveLevel(draft, store)
  assert.equal(saved.name, '自定义测试关卡')
  assert.deepEqual(loadLevel(store), saved)
  const preview = playableLevel(draft)
  preview.layout[0] = '.'.repeat(12)
  assert.notDeepEqual(preview.layout, draft.layout)
  assert.deepEqual(loadLevel(store), saved)
  const changed = { ...draft, layout: paintLine(draft.layout, [0, 0], [0, 0], 'X') }
  saveLevel(changed, store)
  assert.equal(loadLevel(store)?.layout[0][0], 'X')
})

test('malformed stored levels are rejected and preserved when a save is attempted', () => {
  const good = createLevel(0)
  for (const value of [
    null,
    [],
    { ...good, version: 2 },
    { ...good, name: ' ' },
    { ...good, name: 'a'.repeat(41) },
    { ...good, layout: [] },
    { ...good, layout: Array(10).fill('short') },
    { ...good, layout: Array(10).fill('????????????') },
  ])
    assert.throws(() => parseLevel(value))
  for (const raw of ['{invalid', JSON.stringify({ ...good, version: 2 })]) {
    const store = storage()
    store.setItem(CUSTOM_LEVEL_KEY, raw)
    assert.throws(() => loadLevel(store), /原数据已保留/)
    assert.throws(() => saveLevel(good, store), /原数据已保留/)
    assert.equal(store.getItem(CUSTOM_LEVEL_KEY), raw)
  }
})

test('unavailable storage and failed writes propagate without discarding the draft', () => {
  const draft = createLevel(0)
  const before = JSON.stringify(draft)
  const blocked = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {},
  }
  assert.throws(() => loadLevel(blocked), /denied/)
  const store = storage()
  saveLevel(draft, store)
  const savedBefore = store.getItem(CUSTOM_LEVEL_KEY)
  const full = {
    ...store,
    setItem: () => {
      throw new Error('quota')
    },
  }
  assert.throws(() => saveLevel({ ...draft, name: '新的名称' }, full), /quota/)
  assert.equal(store.getItem(CUSTOM_LEVEL_KEY), savedBefore)
  assert.equal(JSON.stringify(draft), before)
})
