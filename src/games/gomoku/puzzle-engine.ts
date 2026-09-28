export const SIZE = 15
export type Stone = 0 | 1 | 2
export type Board = readonly Stone[]
export const coordinate = (point: number) =>
  `${String.fromCharCode(65 + (point % SIZE))}${Math.floor(point / SIZE) + 1}`

export function parsePoint(text: string): number {
  if (!/^[A-O](?:[1-9]|1[0-5])$/.test(text)) throw new Error(`无效坐标：${text}`)
  return (Number(text.slice(1)) - 1) * SIZE + text.charCodeAt(0) - 65
}

export function makeBoard(black: readonly string[], white: readonly string[]): Board {
  const board: Stone[] = Array<Stone>(SIZE * SIZE).fill(0)
  for (const [stones, side] of [
    [black, 1],
    [white, 2],
  ] as const) {
    for (const text of stones) {
      const point = parsePoint(text)
      if (board[point]) throw new Error(`重复坐标：${text}`)
      board[point] = side
    }
  }
  return board
}

// Every length-five window, including windows inside an overline (free-style rules).
const lines: number[][] = []
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ]) {
      const endX = x + dx * 4
      const endY = y + dy * 4
      if (endX < 0 || endX >= SIZE || endY < 0 || endY >= SIZE) continue
      lines.push(Array.from({ length: 5 }, (_, k) => (y + dy * k) * SIZE + x + dx * k))
    }
  }
}

export function winningLine(board: Board, side: 1 | 2): number[] {
  return lines.find((line) => line.every((point) => board[point] === side)) ?? []
}

export function winningPoints(board: Board, side: 1 | 2): number[] {
  const points = new Set<number>()
  for (const line of lines) {
    let own = 0
    let empty = -1
    for (const point of line) {
      if (board[point] === side) own++
      else if (board[point] === 0) empty = point
    }
    if (own === 4 && empty !== -1) points.add(empty)
  }
  return [...points].sort((a, b) => a - b)
}

export function place(board: Board, point: number, side: 1 | 2): Board {
  if (!Number.isInteger(point) || point < 0 || point >= SIZE * SIZE || board[point] !== 0)
    throw new Error('只能在空交叉点落子')
  const next = [...board]
  next[point] = side
  return next
}

function fourCandidates(board: Board): number[] {
  const points = new Set<number>()
  for (const line of lines) {
    if (line.some((point) => board[point] === 2)) continue
    if (line.filter((point) => board[point] === 1).length !== 3) continue
    for (const point of line) if (!board[point]) points.add(point)
  }
  return [...points].sort((a, b) => a - b)
}

/** Exact search for the stated continuous-four objective, not a general Gomoku solver.
 * A single threat forces White's reply; two threats win unless White can win first.
 * Every possible four-making move is searched, so alternative solutions are accepted.
 */
export function solvePuzzle(board: Board, remaining: number): number[] {
  const memo = new Map<string, number[]>()
  function search(position: Board, budget: number): number[] {
    if (budget < 1 || winningLine(position, 1).length || winningLine(position, 2).length) return []
    const immediate = winningPoints(position, 1)
    if (immediate.length) return immediate
    if (budget < 2) return []
    const key = position.join('') + ':' + budget
    const cached = memo.get(key)
    if (cached) return cached
    const whiteWins = winningPoints(position, 2)
    if (whiteWins.length > 1) return []
    const answers: number[] = []
    for (const point of fourCandidates(position)) {
      if (whiteWins.length && point !== whiteWins[0]) continue
      const attack = place(position, point, 1)
      const threats = winningPoints(attack, 1)
      if (
        threats.length > 1 ||
        (threats.length === 1 && search(place(attack, threats[0], 2), budget - 1).length)
      )
        answers.push(point)
    }
    memo.set(key, answers)
    return answers
  }
  return search(board, remaining)
}

export interface PuzzleState {
  board: Board
  moves: number
  status: 'playing' | 'won' | 'lost'
  message: string
  lastBlack: number | null
  lastWhite: number | null
}

export function initialState(board: Board): PuzzleState {
  return {
    board,
    moves: 0,
    status: 'playing',
    message: '执黑先行，点击交叉点落子',
    lastBlack: null,
    lastWhite: null,
  }
}

export function playRound(state: PuzzleState, point: number, limit: number): PuzzleState {
  if (state.status !== 'playing' || !Number.isInteger(point) || state.board[point] !== 0)
    return state
  const board = place(state.board, point, 1)
  const next: PuzzleState = {
    board,
    moves: state.moves + 1,
    status: 'playing',
    message: '',
    lastBlack: point,
    lastWhite: null,
  }
  if (winningLine(board, 1).length)
    return { ...next, status: 'won', message: '五子连珠，挑战成功！' }
  const whiteWins = winningPoints(board, 2)
  if (whiteWins.length)
    return {
      ...next,
      board: place(board, whiteWins[0], 2),
      lastWhite: whiteWins[0],
      status: 'lost',
      message: `白棋在 ${coordinate(whiteWins[0])} 成五。先观察对手的直接威胁。`,
    }
  if (next.moves >= limit)
    return {
      ...next,
      status: 'lost',
      message: `${limit} 手已用完，还未连成五子。试试另一条进攻路线。`,
    }
  const threats = winningPoints(board, 1)
  if (!threats.length)
    return {
      ...next,
      status: 'lost',
      message: '这一步没有形成冲四。本关需要连续制造下一手成五的威胁。',
    }
  const reply = threats[0]
  next.board = place(board, reply, 2)
  next.lastWhite = reply
  if (!solvePuzzle(next.board, limit - next.moves).length)
    return {
      ...next,
      status: 'lost',
      message: `白棋封住 ${coordinate(reply)}，剩余 ${limit - next.moves} 手无法完成连续冲四。可以悔棋换条路线。`,
    }
  next.message = `白棋封住 ${coordinate(reply)}，轮到你继续进攻`
  return next
}

export function solutionLine(board: Board, remaining: number): string {
  let state = initialState(board)
  const steps: string[] = []
  for (let i = 0; i < remaining; i++) {
    const point = solvePuzzle(state.board, remaining - i)[0]
    if (point === undefined) break
    state = playRound(state, point, remaining)
    steps.push(
      `黑 ${coordinate(point)}${state.lastWhite === null ? '' : ` → 白 ${coordinate(state.lastWhite)}`}`,
    )
    if (state.status !== 'playing') break
  }
  return steps.join('；')
}
