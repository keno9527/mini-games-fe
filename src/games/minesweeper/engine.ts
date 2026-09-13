export type CellState = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export type Difficulty = '简单' | '中等' | '复杂'

export const CONFIGS: Record<Difficulty, { rows: number; cols: number; mines: number }> = {
  简单: { rows: 9, cols: 9, mines: 10 },
  中等: { rows: 16, cols: 16, mines: 40 },
  复杂: { rows: 16, cols: 30, mines: 99 },
}

export function createBoard(
  rows: number,
  cols: number,
  mines: number,
  skipR: number,
  skipC: number,
): CellState[][] {
  const board: CellState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  )
  let placed = 0
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    if (!board[r][c].mine && !(Math.abs(r - skipR) <= 1 && Math.abs(c - skipC) <= 1)) {
      board[r][c].mine = true
      placed++
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr,
            nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++
        }
      }
      board[r][c].adjacent = count
    }
  }
  return board
}

export function reveal(board: CellState[][], r: number, c: number): CellState[][] {
  const b = board.map((row) => row.map((cell) => ({ ...cell })))
  const stack = [[r, c]]
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!
    const cell = b[cr][cc]
    if (cell.revealed || cell.flagged || cell.mine) continue
    cell.revealed = true
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr,
            nc = cc + dc
          if (nr >= 0 && nr < b.length && nc >= 0 && nc < b[0].length && !b[nr][nc].revealed) {
            stack.push([nr, nc])
          }
        }
      }
    }
  }
  return b
}

export function toggleFlag(board: CellState[][], r: number, c: number): CellState[][] {
  if (board[r][c].revealed) return board
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === r && colIndex === c ? { ...cell, flagged: !cell.flagged } : cell,
    ),
  )
}

export function isCleared(board: CellState[][]): boolean {
  return board.every((row) => row.every((cell) => cell.mine || cell.revealed))
}
