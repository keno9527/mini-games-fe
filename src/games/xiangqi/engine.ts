export type Side = 'red' | 'black'
export type Piece =
  'K' | 'A' | 'B' | 'N' | 'R' | 'C' | 'P' | 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p'
export type Board = readonly (Piece | null)[]
export interface Move {
  from: number
  to: number
}

export const sideOf = (piece: Piece): Side => (piece === piece.toUpperCase() ? 'red' : 'black')
export const opposite = (side: Side): Side => (side === 'red' ? 'black' : 'red')
export const pieceName = (piece: Piece): string =>
  ({
    K: '帅',
    A: '仕',
    B: '相',
    N: '马',
    R: '车',
    C: '炮',
    P: '兵',
    k: '将',
    a: '士',
    b: '象',
    n: '马',
    r: '车',
    c: '炮',
    p: '卒',
  })[piece]
export const squareName = (square: number): string =>
  `${'ABCDEFGHI'[square % 9]}${10 - Math.floor(square / 9)}`
const inside = (x: number, y: number) => x >= 0 && x < 9 && y >= 0 && y < 10
const palace = (x: number, y: number, side: Side) =>
  x >= 3 && x <= 5 && (side === 'red' ? y >= 7 && y <= 9 : y >= 0 && y <= 2)
const straight = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export function parseBoard(fen: string): Board {
  const rows = fen.split('/')
  if (rows.length !== 10) throw new Error('棋盘需要十行')
  return rows.flatMap((row) => {
    const cells: (Piece | null)[] = []
    for (const char of row) {
      if (/^[1-9]$/.test(char)) cells.push(...Array<null>(Number(char)).fill(null))
      else if (/^[KABNRCPkabnrcp]$/.test(char)) cells.push(char as Piece)
      else throw new Error(`未知棋子 ${char}`)
    }
    if (cells.length !== 9) throw new Error('棋盘每行需要九列')
    return cells
  })
}

export function applyMove(board: Board, move: Move): Board {
  const next = [...board]
  next[move.to] = next[move.from]
  next[move.from] = null
  return next
}

// Includes attacks on the opposing king, for check detection only.
function targets(board: Board, from: number): number[] {
  const piece = board[from]
  if (!piece) return []
  const side = sideOf(piece),
    kind = piece.toUpperCase()
  const x = from % 9,
    y = Math.floor(from / 9)
  const out: number[] = []
  const add = (tx: number, ty: number) => {
    if (!inside(tx, ty)) return
    const target = board[ty * 9 + tx]
    if (!target || sideOf(target) !== side) out.push(ty * 9 + tx)
  }
  if (kind === 'R' || kind === 'C') {
    for (const [dx, dy] of straight) {
      let screen = false
      for (let tx = x + dx, ty = y + dy; inside(tx, ty); tx += dx, ty += dy) {
        const target = board[ty * 9 + tx]
        if (!screen) {
          if (!target) add(tx, ty)
          else if (kind === 'R') {
            add(tx, ty)
            break
          } else screen = true
        } else if (target) {
          add(tx, ty)
          break
        }
      }
    }
  } else if (kind === 'N') {
    for (const [dx, dy] of [
      [1, 2],
      [-1, 2],
      [1, -2],
      [-1, -2],
      [2, 1],
      [2, -1],
      [-2, 1],
      [-2, -1],
    ]) {
      const legX = x + (Math.abs(dx) === 2 ? Math.sign(dx) : 0)
      const legY = y + (Math.abs(dy) === 2 ? Math.sign(dy) : 0)
      if (inside(legX, legY) && !board[legY * 9 + legX]) add(x + dx, y + dy)
    }
  } else if (kind === 'B') {
    for (const dx of [-2, 2])
      for (const dy of [-2, 2]) {
        const ty = y + dy
        if (
          (side === 'red' ? ty >= 5 : ty <= 4) &&
          inside(x + dx, ty) &&
          !board[(y + dy / 2) * 9 + x + dx / 2]
        )
          add(x + dx, ty)
      }
  } else if (kind === 'A') {
    for (const dx of [-1, 1])
      for (const dy of [-1, 1]) if (palace(x + dx, y + dy, side)) add(x + dx, y + dy)
  } else if (kind === 'K') {
    for (const [dx, dy] of straight) if (palace(x + dx, y + dy, side)) add(x + dx, y + dy)
    for (const dy of [-1, 1]) {
      for (let ty = y + dy; inside(x, ty); ty += dy) {
        const target = board[ty * 9 + x]
        if (!target) continue
        if (target.toUpperCase() === 'K' && sideOf(target) !== side) out.push(ty * 9 + x)
        break
      }
    }
  } else if (kind === 'P') {
    add(x, y + (side === 'red' ? -1 : 1))
    if (side === 'red' ? y <= 4 : y >= 5) {
      add(x - 1, y)
      add(x + 1, y)
    }
  }
  return out
}

export function isInCheck(board: Board, side: Side): boolean {
  const king = board.indexOf(side === 'red' ? 'K' : 'k')
  if (king < 0) return true
  return board.some(
    (piece, from) => piece && sideOf(piece) !== side && targets(board, from).includes(king),
  )
}

export function legalMoves(board: Board, side: Side): Move[] {
  if (!board.includes(side === 'red' ? 'K' : 'k')) return []
  const moves: Move[] = []
  board.forEach((piece, from) => {
    if (!piece || sideOf(piece) !== side) return
    for (const to of targets(board, from)) {
      // Play ends on mate/stalemate; generals are never captured on the board.
      if (board[to]?.toUpperCase() === 'K') continue
      const move = { from, to }
      if (!isInCheck(applyMove(board, move), side)) moves.push(move)
    }
  })
  return moves
}

export type Proof = 'win' | 'escape' | 'unknown'
export interface SearchResult {
  proof: Proof
  move: Move | null
  nodes: number
}
const values: Record<string, number> = { K: 10000, R: 90, N: 40, C: 45, A: 20, B: 20, P: 10 }

function orderedMoves(board: Board, side: Side): Move[] {
  return legalMoves(board, side)
    .map((move) => ({
      move,
      score:
        (board[move.to] ? values[board[move.to]!.toUpperCase()] : 0) +
        (isInCheck(applyMove(board, move), opposite(side)) ? 200 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.move)
}

// AND/OR proof search: red needs one winning move; every black reply must lose.
// Unknown is distinct from an escape when the computation budget is exhausted.
export function solve(board: Board, side: Side, redMoves: number, budget = 60000): SearchResult {
  let nodes = 0
  const memo = new Map<string, Proof>()
  function search(position: Board, turn: Side, remaining: number): Proof {
    if (++nodes > budget) return 'unknown'
    const key = `${position.map((p) => p ?? '.').join('')}:${turn}:${remaining}`
    const cached = memo.get(key)
    if (cached) return cached
    const moves = orderedMoves(position, turn)
    if (!moves.length) return turn === 'black' ? 'win' : 'escape'
    if (remaining <= 0) return 'escape'
    let uncertain = false
    for (const move of moves) {
      const result = search(
        applyMove(position, move),
        opposite(turn),
        remaining - (turn === 'red' ? 1 : 0),
      )
      if ((turn === 'red' && result === 'win') || (turn === 'black' && result === 'escape')) {
        memo.set(key, result)
        return result
      }
      uncertain ||= result === 'unknown'
      if (nodes > budget) break
    }
    const result = uncertain ? 'unknown' : turn === 'red' ? 'escape' : 'win'
    if (result !== 'unknown') memo.set(key, result)
    return result
  }
  const moves = orderedMoves(board, side)
  if (!moves.length) return { proof: side === 'black' ? 'win' : 'escape', move: null, nodes }
  if (redMoves <= 0) return { proof: 'escape', move: side === 'black' ? moves[0] : null, nodes }
  let uncertain = false
  for (const move of moves) {
    const proof = search(
      applyMove(board, move),
      opposite(side),
      redMoves - (side === 'red' ? 1 : 0),
    )
    if ((side === 'red' && proof === 'win') || (side === 'black' && proof === 'escape'))
      return { proof, move, nodes }
    uncertain ||= proof === 'unknown'
    if (nodes > budget) break
  }
  return {
    proof: uncertain ? 'unknown' : side === 'red' ? 'escape' : 'win',
    move: side === 'black' ? moves[0] : null,
    nodes,
  }
}
