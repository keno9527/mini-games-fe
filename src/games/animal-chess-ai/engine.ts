import {
  ANIMAL_META,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createInitialState as createClassicState,
  getPiece,
  type GameState as ClassicState,
  type Move,
  type Piece,
  type Position,
  type Side,
} from '../animal-chess/engine.ts'

// Share only the board model and initial layout, never the classic terrain rules.
export { ANIMAL_META, BOARD_HEIGHT, BOARD_WIDTH, getPiece }
export type { Animal, Move, Piece, Position, Side } from '../animal-chess/engine.ts'

export interface GameState extends ClassicState {
  skippedSide: Side | null
}

const adjacentOffsets = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const
const samePosition = (a: Position, b: Position) => a.x === b.x && a.y === b.y
const insideBoard = ({ x, y }: Position) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  x < BOARD_WIDTH &&
  y >= 0 &&
  y < BOARD_HEIGHT

export function createInitialState(): GameState {
  return { ...createClassicState(), skippedSide: null }
}

export function canCapture(attacker: Piece, defender: Piece): boolean {
  if (attacker.side === defender.side) return false
  if (attacker.animal === 'rat' && defender.animal === 'elephant') return true
  if (attacker.animal === 'elephant' && defender.animal === 'rat') return false
  return ANIMAL_META[attacker.animal].rank >= ANIMAL_META[defender.animal].rank
}

export function getMoveError(state: GameState, from: Position, to: Position): string | null {
  if (state.winner) return '对局已结束，请重新开局。'
  if (!insideBoard(from) || !insideBoard(to)) return '不能移出棋盘。'
  const piece = getPiece(state, from)
  if (!piece) return '请先选择一枚棋子。'
  if (piece.side !== state.turn) return '还没有轮到这一方行动。'
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 1)
    return '每回合只能向上下左右移动一格。'
  const target = getPiece(state, to)
  if (!target) return null
  if (target.side === piece.side) return '不能移动到己方棋子所在的位置。'
  if (!canCapture(piece, target))
    return piece.animal === 'elephant' && target.animal === 'rat'
      ? '象不能吃鼠，请选择其他落点。'
      : '只能吃同级或更弱的棋子；鼠可以吃象。'
  return null
}

export function getLegalMoves(state: GameState, from: Position): Position[] {
  return adjacentOffsets
    .map(([dx, dy]) => ({ x: from.x + dx, y: from.y + dy }))
    .filter((to) => getMoveError(state, from, to) === null)
}

export function getAllLegalMoves(state: GameState): Move[] {
  return state.pieces
    .filter((piece) => piece.side === state.turn)
    .flatMap((piece) =>
      getLegalMoves(state, piece.position).map((to) => ({ from: piece.position, to })),
    )
}

export function applyMove(state: GameState, from: Position, to: Position): GameState {
  if (getMoveError(state, from, to)) return state
  const nextTurn = state.turn === 'red' ? 'blue' : 'red'
  const pieces = state.pieces
    .filter((piece) => !samePosition(piece.position, to))
    .map((piece) =>
      samePosition(piece.position, from) ? { ...piece, position: { ...to } } : piece,
    )
  const nextState: GameState = {
    pieces,
    turn: nextTurn,
    winner: pieces.some((piece) => piece.side === nextTurn) ? null : state.turn,
    moves: state.moves + 1,
    lastMove: { from: { ...from }, to: { ...to } },
    skippedSide: null,
  }
  // Being blocked is not defeat: only elimination ends the game.
  if (!nextState.winner && getAllLegalMoves(nextState).length === 0)
    return { ...nextState, turn: state.turn, skippedSide: nextTurn }
  return nextState
}

export function chooseComputerMove(
  state: GameState,
  random: () => number = Math.random,
): Move | null {
  if (state.turn !== 'blue' || state.winner) return null
  const moves = getAllLegalMoves(state)
  const captures = moves.filter((move) => getPiece(state, move.to))
  const candidates = captures.length ? captures : moves
  if (!candidates.length) return null
  return candidates[Math.floor(random() * candidates.length)]
}

export function getOutcome(winner: Side): { result: 'win' | 'lose'; score: number } {
  return winner === 'red' ? { result: 'win', score: 100 } : { result: 'lose', score: 0 }
}
