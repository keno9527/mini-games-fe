import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONFIGS,
  createBoard,
  isCleared,
  reveal,
  toggleFlag,
  type CellState,
} from '../src/games/minesweeper/engine.ts'

for (const [difficulty, config] of Object.entries(CONFIGS)) {
  test(`${difficulty}: preserves dimensions, mine count, and a safe first opening`, () => {
    const { rows, cols, mines } = config
    for (const [r, c] of [
      [0, 0],
      [Math.floor(rows / 2), Math.floor(cols / 2)],
      [rows - 1, cols - 1],
    ]) {
      const board = createBoard(rows, cols, mines, r, c)
      assert.equal(board.length, rows)
      assert.ok(board.every((row) => row.length === cols))
      assert.equal(board.flat().filter((cell) => cell.mine).length, mines)
      assert.equal(board[r][c].adjacent, 0)
      for (let y = Math.max(0, r - 1); y <= Math.min(rows - 1, r + 1); y++) {
        for (let x = Math.max(0, c - 1); x <= Math.min(cols - 1, c + 1); x++)
          assert.equal(board[y][x].mine, false)
      }
      const opened = reveal(board, r, c)
      assert.equal(opened[r][c].revealed, true)
      assert.ok(opened.flat().every((cell) => !(cell.mine && cell.revealed)))
      assert.ok(board.flat().every((cell) => !cell.revealed))
    }
  })
}

function smallBoard(): CellState[][] {
  return [
    [0, 0, 0],
    [0, 1, 1],
    [0, 1, -1],
  ].map((row) =>
    row.map((value) => ({
      mine: value < 0,
      adjacent: Math.max(0, value),
      revealed: false,
      flagged: false,
    })),
  )
}

test('opening a zero expands to the numbered boundary and never reveals a mine', () => {
  const board = smallBoard()
  const next = reveal(board, 0, 0)
  assert.equal(next.flat().filter((cell) => cell.revealed).length, 8)
  assert.equal(next[2][2].revealed, false)
  assert.equal(isCleared(next), true)
  assert.equal(isCleared(board), false)
})

test('flags protect covered cells until cancelled, including during flood reveal', () => {
  const board = smallBoard()
  const flagged = toggleFlag(board, 0, 1)
  assert.equal(board[0][1].flagged, false)
  assert.equal(flagged[0][1].flagged, true)
  const next = reveal(flagged, 0, 0)
  assert.equal(next[0][1].revealed, false)
  assert.equal(isCleared(next), false)
  assert.equal(toggleFlag(next, 0, 0), next)
  const unflagged = toggleFlag(next, 0, 1)
  assert.equal(unflagged[0][1].flagged, false)
  assert.equal(isCleared(reveal(unflagged, 0, 1)), true)
})

test('adjacent counts include diagonals and stay within board edges', () => {
  const board = createBoard(9, 9, 10, 4, 4)
  const minePositions = board.flatMap((row, r) =>
    row.flatMap((cell, c) => (cell.mine ? [[r, c]] : [])),
  )
  board.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell.mine)
        assert.equal(
          cell.adjacent,
          minePositions.filter(([y, x]) => Math.abs(y - r) <= 1 && Math.abs(x - c) <= 1).length,
        )
    }),
  )
})
