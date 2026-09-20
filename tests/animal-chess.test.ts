import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyMove,
  createInitialState,
  getLegalMoves,
  getPiece,
  type GameState,
  type Piece,
  type Position,
} from '../src/games/animal-chess/engine.ts'
import { getCatalogGame } from '../src/features/games/data.ts'

const at = (x: number, y: number): Position => ({ x, y })
const piece = (side: Piece['side'], animal: Piece['animal'], x: number, y: number): Piece => ({
  side,
  animal,
  position: at(x, y),
})

function state(pieces: Piece[], turn: GameState['turn'] = 'red'): GameState {
  return { pieces, turn, winner: null, moves: 0, lastMove: null }
}

const canMove = (game: GameState, from: Position, to: Position) =>
  getLegalMoves(game, from).some((position) => position.x === to.x && position.y === to.y)

test('animal chess is registered as an embedded plaza game', () => {
  const game = getCatalogGame('animal-chess')
  assert.equal(game?.name, '斗兽棋')
  assert.deepEqual(game?.difficulties, ['本地双人'])
})

test('initial board contains both complete armies and red moves first', () => {
  const game = createInitialState()
  assert.equal(game.pieces.length, 16)
  assert.equal(game.pieces.filter(({ side }) => side === 'red').length, 8)
  assert.equal(game.pieces.filter(({ side }) => side === 'blue').length, 8)
  assert.equal(game.turn, 'red')
  assert.equal(getPiece(game, at(0, 6))?.animal, 'elephant')
  assert.equal(getPiece(game, at(6, 2))?.animal, 'elephant')
})

test('pieces move orthogonally and capture animals at or below their rank', () => {
  const game = state([
    piece('red', 'dog', 3, 4),
    piece('blue', 'cat', 3, 3),
    piece('blue', 'wolf', 4, 4),
  ])
  assert.equal(canMove(game, at(3, 4), at(3, 3)), true)
  assert.equal(canMove(game, at(3, 4), at(4, 4)), false)
  assert.equal(canMove(game, at(3, 4), at(4, 5)), false)
})

test('rat can capture elephant while elephant cannot capture rat', () => {
  assert.equal(
    canMove(
      state([piece('red', 'rat', 0, 1), piece('blue', 'elephant', 0, 0)]),
      at(0, 1),
      at(0, 0),
    ),
    true,
  )
  assert.equal(
    canMove(
      state([piece('red', 'elephant', 0, 1), piece('blue', 'rat', 0, 0)]),
      at(0, 1),
      at(0, 0),
    ),
    false,
  )
})

test('only rats enter water and rats cannot capture across the bank', () => {
  const rat = state([piece('red', 'rat', 0, 3), piece('blue', 'rat', 1, 3)])
  assert.equal(canMove(rat, at(0, 3), at(1, 3)), false)
  assert.equal(canMove(state([piece('red', 'rat', 1, 3)]), at(1, 3), at(1, 4)), true)
  assert.equal(canMove(state([piece('red', 'cat', 0, 3)]), at(0, 3), at(1, 3)), false)
})

test('lion and tiger jump a clear river but a rat blocks the jump', () => {
  const clear = state([piece('red', 'tiger', 1, 2), piece('blue', 'wolf', 1, 6)])
  assert.equal(canMove(clear, at(1, 2), at(1, 6)), true)
  const blocked = state([...clear.pieces, piece('blue', 'rat', 1, 4)])
  assert.equal(canMove(blocked, at(1, 2), at(1, 6)), false)
})

test('a trapped defender can be captured regardless of its rank', () => {
  const game = state([piece('red', 'cat', 3, 6), piece('blue', 'elephant', 3, 7)])
  assert.equal(canMove(game, at(3, 6), at(3, 7)), true)
})

test('an animal inside the opposing trap cannot capture with its original rank', () => {
  const game = state([piece('red', 'elephant', 3, 1), piece('blue', 'cat', 3, 2)])
  assert.equal(canMove(game, at(3, 1), at(3, 2)), false)
})

test('pieces cannot enter their own den and entering the opposing den wins', () => {
  const ownDen = state([piece('red', 'cat', 3, 7)])
  assert.equal(canMove(ownDen, at(3, 7), at(3, 8)), false)

  const nearBlueDen = state([piece('red', 'cat', 3, 1), piece('blue', 'rat', 6, 6)])
  const finished = applyMove(nearBlueDen, at(3, 1), at(3, 0))
  assert.equal(finished.winner, 'red')
  assert.equal(finished.moves, 1)
})

test('moves are immutable, switch turns, capture pieces, and reject illegal input', () => {
  const game = state([
    piece('red', 'dog', 3, 4),
    piece('blue', 'cat', 3, 3),
    piece('blue', 'rat', 6, 6),
  ])
  const illegal = applyMove(game, at(3, 4), at(4, 4))
  assert.equal(illegal, game)

  const next = applyMove(game, at(3, 4), at(3, 3))
  assert.notEqual(next, game)
  assert.equal(getPiece(game, at(3, 4))?.animal, 'dog')
  assert.equal(getPiece(next, at(3, 3))?.animal, 'dog')
  assert.equal(next.pieces.length, 2)
  assert.equal(next.turn, 'blue')
  assert.deepEqual(next.lastMove, { from: at(3, 4), to: at(3, 3) })
})
