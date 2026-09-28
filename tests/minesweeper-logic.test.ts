import test from 'node:test'
import assert from 'node:assert/strict'
import { LOGIC_LEVELS } from '../src/games/minesweeper/levels'
import {
  chapterUnlocked,
  completeLevel,
  createLogicBoard,
  findLogicHint,
  neighbors,
  parseProgress,
} from '../src/games/minesweeper/logic'
import { isCleared, reveal, toggleFlag } from '../src/games/minesweeper/engine'

for (const level of LOGIC_LEVELS)
  test(`logic level ${level.id}: valid fixed board and hints solve without guessing`, () => {
    let board = createLogicBoard(level)
    assert.equal(new Set(level.mines).size, level.mines.length)
    assert.ok(level.mines.every((i) => i >= 0 && i < level.rows * level.cols))
    assert.ok(level.initial.every((i) => !level.mines.includes(i)))
    for (const extra of level.extras)
      assert.equal(extra.cells.filter((i) => level.mines.includes(i)).length, extra.count)
    for (const i of level.initial)
      if (board.flat()[i].adjacent === 0)
        assert.ok(neighbors(i, level.rows, level.cols).every((n) => level.initial.includes(n)))
    const initial = JSON.stringify(board)
    for (let step = 0; step < 200 && !isCleared(board); step++) {
      const hint = findLogicHint(board, level)
      assert.ok(hint, `no deduction at step ${step}`)
      for (const i of hint.cells) {
        const r = Math.floor(i / level.cols),
          c = i % level.cols
        assert.equal(board[r][c].mine, hint.mine)
        board = hint.mine
          ? board[r][c].flagged
            ? board
            : toggleFlag(board, r, c)
          : reveal(board, r, c)
      }
    }
    assert.ok(isCleared(board))
    assert.equal(JSON.stringify(createLogicBoard(level)), initial)
  })
test('flags are never accepted as proof, even when every covered square is flagged', () => {
  for (const level of LOGIC_LEVELS) {
    const board = createLogicBoard(level).map((row) =>
      row.map((cell) => ({ ...cell, flagged: !cell.revealed })),
    )
    const hint = findLogicHint(board, level)
    assert.ok(hint)
    assert.equal(hint.mine, false)
    assert.ok(hint.cells.every((i) => !board.flat()[i].mine))
  }
})
test('unlock allows four completions or capstone, badges only accumulate', () => {
  let progress = completeLevel({}, 5, false)
  assert.equal(chapterUnlocked(1, progress), true)
  assert.equal(chapterUnlocked(2, progress), false)
  progress = completeLevel(progress, 5, true)
  progress = completeLevel(progress, 5, false)
  assert.equal(progress[5].unaided, true)
  assert.equal(
    chapterUnlocked(
      1,
      Object.fromEntries([1, 2, 3].map((id) => [id, { completed: true, unaided: false }])),
    ),
    false,
  )
  assert.equal(
    chapterUnlocked(
      1,
      Object.fromEntries([1, 2, 3, 4].map((id) => [id, { completed: true, unaided: false }])),
    ),
    true,
  )
})
test('corrupt stored data cannot unlock chapters', () => {
  for (const raw of ['null', 'broken', '[]', '{"5":{"completed":"yes"}}'])
    assert.deepEqual(parseProgress(raw), {})
  assert.deepEqual(parseProgress('{"5":{"completed":true,"unaided":false}}'), {
    5: { completed: true, unaided: false },
  })
})
