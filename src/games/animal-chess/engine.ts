export type Side = 'red' | 'blue'
export type Animal = 'rat' | 'cat' | 'dog' | 'wolf' | 'leopard' | 'tiger' | 'lion' | 'elephant'

export interface Position {
  x: number
  y: number
}

export interface Piece {
  side: Side
  animal: Animal
  position: Position
}

export interface Move {
  from: Position
  to: Position
}

export interface GameState {
  pieces: readonly Piece[]
  turn: Side
  winner: Side | null
  moves: number
  lastMove: Move | null
}

export type Terrain = 'land' | 'water' | 'trap' | 'den'

export const BOARD_WIDTH = 7
export const BOARD_HEIGHT = 9

export const ANIMAL_META: Record<Animal, { name: string; symbol: string; rank: number }> = {
  rat: { name: '鼠', symbol: '鼠', rank: 1 },
  cat: { name: '猫', symbol: '猫', rank: 2 },
  dog: { name: '狗', symbol: '狗', rank: 3 },
  wolf: { name: '狼', symbol: '狼', rank: 4 },
  leopard: { name: '豹', symbol: '豹', rank: 5 },
  tiger: { name: '虎', symbol: '虎', rank: 6 },
  lion: { name: '狮', symbol: '狮', rank: 7 },
  elephant: { name: '象', symbol: '象', rank: 8 },
}

const WATER = new Set([
  '1,3',
  '2,3',
  '4,3',
  '5,3',
  '1,4',
  '2,4',
  '4,4',
  '5,4',
  '1,5',
  '2,5',
  '4,5',
  '5,5',
])

const BLUE_TRAPS = new Set(['2,0', '4,0', '3,1'])
const RED_TRAPS = new Set(['2,8', '4,8', '3,7'])

const keyOf = ({ x, y }: Position) => `${x},${y}`
const samePosition = (left: Position, right: Position) => left.x === right.x && left.y === right.y
const insideBoard = ({ x, y }: Position) => x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT
const opposite = (side: Side): Side => (side === 'red' ? 'blue' : 'red')

export function getTerrain(position: Position): Terrain {
  const key = keyOf(position)
  if (WATER.has(key)) return 'water'
  if (key === '3,0' || key === '3,8') return 'den'
  if (BLUE_TRAPS.has(key) || RED_TRAPS.has(key)) return 'trap'
  return 'land'
}

export function getTerrainOwner(position: Position): Side | null {
  const key = keyOf(position)
  if (key === '3,0' || BLUE_TRAPS.has(key)) return 'blue'
  if (key === '3,8' || RED_TRAPS.has(key)) return 'red'
  return null
}

export function getPiece(state: Pick<GameState, 'pieces'>, position: Position): Piece | undefined {
  return state.pieces.find((piece) => samePosition(piece.position, position))
}

export function createInitialState(): GameState {
  const pieces: Piece[] = [
    { side: 'blue', animal: 'lion', position: { x: 0, y: 0 } },
    { side: 'blue', animal: 'tiger', position: { x: 6, y: 0 } },
    { side: 'blue', animal: 'dog', position: { x: 1, y: 1 } },
    { side: 'blue', animal: 'cat', position: { x: 5, y: 1 } },
    { side: 'blue', animal: 'rat', position: { x: 0, y: 2 } },
    { side: 'blue', animal: 'leopard', position: { x: 2, y: 2 } },
    { side: 'blue', animal: 'wolf', position: { x: 4, y: 2 } },
    { side: 'blue', animal: 'elephant', position: { x: 6, y: 2 } },
    { side: 'red', animal: 'elephant', position: { x: 0, y: 6 } },
    { side: 'red', animal: 'wolf', position: { x: 2, y: 6 } },
    { side: 'red', animal: 'leopard', position: { x: 4, y: 6 } },
    { side: 'red', animal: 'rat', position: { x: 6, y: 6 } },
    { side: 'red', animal: 'cat', position: { x: 1, y: 7 } },
    { side: 'red', animal: 'dog', position: { x: 5, y: 7 } },
    { side: 'red', animal: 'tiger', position: { x: 0, y: 8 } },
    { side: 'red', animal: 'lion', position: { x: 6, y: 8 } },
  ]
  return { pieces, turn: 'red', winner: null, moves: 0, lastMove: null }
}

function canCapture(attacker: Piece, defender: Piece, destination: Position): boolean {
  const fromWater = getTerrain(attacker.position) === 'water'
  const toWater = getTerrain(destination) === 'water'
  if (attacker.animal === 'rat' && fromWater !== toWater) return false

  if (
    getTerrain(attacker.position) === 'trap' &&
    getTerrainOwner(attacker.position) !== attacker.side
  ) {
    return false
  }

  if (getTerrain(destination) === 'trap' && getTerrainOwner(destination) === attacker.side) {
    return true
  }
  if (attacker.animal === 'rat' && defender.animal === 'elephant') return true
  if (attacker.animal === 'elephant' && defender.animal === 'rat') return false
  return ANIMAL_META[attacker.animal].rank >= ANIMAL_META[defender.animal].rank
}

function jumpAcrossWater(state: GameState, piece: Piece, dx: number, dy: number): Position | null {
  if (piece.animal !== 'lion' && piece.animal !== 'tiger') return null
  let current = { x: piece.position.x + dx, y: piece.position.y + dy }
  if (getTerrain(current) !== 'water') return null

  while (insideBoard(current) && getTerrain(current) === 'water') {
    if (getPiece(state, current)?.animal === 'rat') return null
    current = { x: current.x + dx, y: current.y + dy }
  }
  return insideBoard(current) ? current : null
}

function canLand(state: GameState, piece: Piece, destination: Position): boolean {
  if (!insideBoard(destination)) return false
  const terrain = getTerrain(destination)
  if (terrain === 'den' && getTerrainOwner(destination) === piece.side) return false
  if (terrain === 'water' && piece.animal !== 'rat') return false

  const defender = getPiece(state, destination)
  if (!defender) return true
  return defender.side !== piece.side && canCapture(piece, defender, destination)
}

export function getLegalMoves(state: GameState, from: Position): Position[] {
  if (state.winner) return []
  const piece = getPiece(state, from)
  if (!piece || piece.side !== state.turn) return []

  const moves: Position[] = []
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const) {
    const adjacent = { x: from.x + dx, y: from.y + dy }
    const destination =
      getTerrain(adjacent) === 'water'
        ? (jumpAcrossWater(state, piece, dx, dy) ?? adjacent)
        : adjacent
    if (canLand(state, piece, destination)) moves.push(destination)
  }
  return moves
}

function hasAnyLegalMove(state: GameState): boolean {
  return state.pieces
    .filter((piece) => piece.side === state.turn)
    .some((piece) => getLegalMoves(state, piece.position).length > 0)
}

export function applyMove(state: GameState, from: Position, to: Position): GameState {
  if (!getLegalMoves(state, from).some((move) => samePosition(move, to))) return state
  const movingPiece = getPiece(state, from)!
  const nextTurn = opposite(state.turn)
  const pieces = state.pieces
    .filter((piece) => !samePosition(piece.position, to))
    .map((piece) =>
      samePosition(piece.position, from) ? { ...piece, position: { ...to } } : piece,
    )
  const reachedDen = getTerrain(to) === 'den' && getTerrainOwner(to) === nextTurn
  const eliminated = !pieces.some((piece) => piece.side === nextTurn)
  const nextState: GameState = {
    pieces,
    turn: nextTurn,
    winner: reachedDen || eliminated ? movingPiece.side : null,
    moves: state.moves + 1,
    lastMove: { from: { ...from }, to: { ...to } },
  }
  if (!nextState.winner && !hasAnyLegalMove(nextState))
    return { ...nextState, winner: movingPiece.side }
  return nextState
}
