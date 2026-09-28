import { hydratePlayerFile } from '../src/api/playerFiles.ts'
import { playerFixture } from './helpers/player-server.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyMove,
  isInCheck,
  legalMoves,
  parseBoard,
  solve,
  type Board,
  type Piece,
} from '../src/games/xiangqi/engine.ts'
import { chapters, LEVELS_PER_CHAPTER, levels } from '../src/games/xiangqi/levels.ts'
import { newSession, sessionReducer } from '../src/games/xiangqi/session.ts'
import { readProgress, saveProgress, unlockedLevel } from '../src/games/xiangqi/progression.ts'
import { getCatalogGame } from '../src/features/games/data.ts'

function position(entries: [Piece, number, number][]): Board {
  const board = Array<Piece | null>(90).fill(null)
  board[3] = 'k'
  board[86] = 'K'
  for (const [piece, x, y] of entries) board[y * 9 + x] = piece
  return board
}
const pursuit = { ...levels[0], moves: 2, board: parseBoard('4k4/9/R8/1R7/9/4P4/9/9/9/4K4') }
const ladder = { ...levels[0], moves: 1, board: parseBoard('4k4/R8/1R7/9/9/4P4/9/9/9/4K4') }

const canMove = (board: Board, x: number, y: number, tx: number, ty: number) =>
  legalMoves(board, board[y * 9 + x] === board[y * 9 + x]?.toUpperCase() ? 'red' : 'black').some(
    (m) => m.from === y * 9 + x && m.to === ty * 9 + tx,
  )

test('xiangqi is registered as a plaza game', () => {
  assert.equal(getCatalogGame('xiangqi')?.name, '中国象棋 · 残局闯关')
})

test('horse legs block only their corresponding jumps', () => {
  const board = position([
    ['N', 4, 5],
    ['P', 4, 4],
  ])
  assert.equal(canMove(board, 4, 5, 3, 3), false)
  assert.equal(canMove(board, 4, 5, 5, 3), false)
  assert.equal(canMove(board, 4, 5, 6, 4), true)
  assert.equal(canMove(board, 4, 5, 3, 7), true)
})

test('elephants cannot cross the river or jump a blocked eye for either side', () => {
  const board = position([
    ['B', 2, 5],
    ['P', 3, 6],
    ['b', 6, 4],
    ['p', 5, 3],
  ])
  assert.equal(canMove(board, 2, 5, 0, 3), false)
  assert.equal(canMove(board, 2, 5, 4, 7), false)
  assert.equal(canMove(board, 2, 5, 0, 7), true)
  assert.equal(canMove(board, 6, 4, 8, 6), false)
  assert.equal(canMove(board, 6, 4, 4, 2), false)
  assert.equal(canMove(board, 6, 4, 8, 2), true)
})

test('cannon captures require exactly one screen and non-captures cannot jump', () => {
  const bare = position([
    ['C', 0, 5],
    ['r', 0, 1],
  ])
  assert.equal(canMove(bare, 0, 5, 0, 1), false)
  assert.equal(canMove(bare, 0, 5, 0, 2), true)
  const one = position([
    ['C', 0, 5],
    ['r', 0, 1],
    ['P', 0, 3],
  ])
  assert.equal(canMove(one, 0, 5, 0, 1), true)
  assert.equal(canMove(one, 0, 5, 0, 2), false)
  assert.equal(canMove(one, 0, 5, 0, 3), false)
  assert.equal(
    canMove(
      position([
        ['C', 0, 5],
        ['r', 0, 1],
        ['P', 0, 3],
        ['p', 0, 2],
      ]),
      0,
      5,
      0,
      1,
    ),
    false,
  )
})

test('pawns move forward, gain sideways movement after crossing, and never retreat', () => {
  const board = position([
    ['P', 2, 5],
    ['P', 6, 4],
    ['p', 0, 4],
    ['p', 8, 5],
  ])
  assert.equal(canMove(board, 2, 5, 2, 4), true)
  assert.equal(canMove(board, 2, 5, 3, 5), false)
  assert.equal(canMove(board, 6, 4, 5, 4), true)
  assert.equal(canMove(board, 6, 4, 6, 5), false)
  assert.equal(canMove(board, 0, 4, 0, 5), true)
  assert.equal(canMove(board, 0, 4, 1, 4), false)
  assert.equal(canMove(board, 8, 5, 7, 5), true)
  assert.equal(canMove(board, 8, 5, 8, 4), false)
})

test('advisors and generals stay in their palaces', () => {
  const board = position([
    ['A', 3, 7],
    ['a', 5, 2],
  ])
  assert.equal(canMove(board, 3, 7, 4, 8), true)
  assert.equal(canMove(board, 3, 7, 2, 8), false)
  assert.equal(canMove(board, 3, 7, 4, 6), false)
  assert.equal(canMove(board, 5, 2, 4, 1), true)
  assert.equal(canMove(board, 5, 2, 4, 3), false)
  assert.equal(canMove(board, 5, 9, 6, 9), false)
  assert.equal(canMove(board, 5, 9, 5, 8), true)
})

test('rooks cannot jump or capture friendly pieces; moves do not mutate the board', () => {
  const board = position([
    ['R', 0, 6],
    ['P', 0, 4],
    ['p', 0, 2],
  ])
  assert.equal(canMove(board, 0, 6, 0, 2), false)
  assert.equal(canMove(board, 0, 6, 0, 4), false)
  assert.equal(canMove(board, 0, 6, 0, 5), true)
  const next = applyMove(board, { from: 54, to: 45 })
  assert.equal(board[54], 'R')
  assert.equal(next[54], null)
  assert.equal(next[45], 'R')
})

test('flying generals and exposing your own king are illegal', () => {
  const board = parseBoard('4k4/9/9/9/4R4/9/9/9/9/4K4')
  assert.equal(isInCheck(board, 'red'), false)
  assert.equal(canMove(board, 4, 4, 5, 4), false)
  assert.equal(canMove(board, 4, 4, 4, 3), true)
  const exposed = applyMove(board, { from: 40, to: 41 })
  assert.equal(isInCheck(exposed, 'red'), true)
  assert.equal(isInCheck(exposed, 'black'), true)
  const pinned = position([
    ['r', 5, 2],
    ['R', 5, 6],
  ])
  assert.equal(canMove(pinned, 5, 6, 4, 6), false)
})

test('check must be answered, and kings are never captured as a legal move', () => {
  const board = position([
    ['r', 5, 2],
    ['R', 0, 6],
  ])
  assert.equal(isInCheck(board, 'red'), true)
  assert.equal(canMove(board, 0, 6, 1, 6), false)
  assert.equal(canMove(board, 0, 6, 5, 6), true)
  assert.equal(canMove(position([['R', 3, 4]]), 3, 4, 3, 0), false)
})

test('stalemate is a loss even when the general is not in check', () => {
  const board = parseBoard('4k4/9/R8/5R3/9/9/9/9/9/3K5')
  const trapped = applyMove(board, { from: 18, to: 9 })
  assert.equal(isInCheck(trapped, 'black'), false)
  assert.equal(legalMoves(trapped, 'black').length, 0)
  const state = sessionReducer(newSession({ ...levels[0], board }), {
    type: 'move',
    move: { from: 18, to: 9 },
  })
  assert.equal(state.phase, 'won')
  assert.match(state.reason, /困毙/)
})

for (const level of levels) {
  test(`${level.name}: valid start and a forced win in exactly ${level.moves} red moves`, () => {
    assert.equal(level.board.filter((p) => p === 'K').length, 1)
    assert.equal(level.board.filter((p) => p === 'k').length, 1)
    assert.equal(isInCheck(level.board, 'black'), false)
    assert.equal(isInCheck(level.board, 'red'), false)
    assert.ok(legalMoves(level.board, 'black').length)
    assert.equal(solve(level.board, 'red', level.moves - 1).proof, 'escape')
    const proof = solve(level.board, 'red', level.moves)
    assert.equal(proof.proof, 'win')
    assert.ok(proof.move)

    // Check the hint continuation against EVERY legal black response, through the actual session reducer.
    const visited = new Set<string>()
    function prove(state: ReturnType<typeof newSession>) {
      if (state.phase === 'won') return
      assert.equal(state.phase, 'red')
      const key = `${state.board.map((piece) => piece ?? '.').join('')}:${state.moves}`
      if (visited.has(key)) return
      visited.add(key)
      const hint = solve(state.board, 'red', level.moves - state.moves)
      assert.equal(hint.proof, 'win')
      assert.ok(hint.move)
      const next = sessionReducer(state, { type: 'move', move: hint.move })
      if (next.phase === 'won') return
      assert.equal(next.phase, 'black')
      for (const move of legalMoves(next.board, 'black'))
        prove(sessionReducer(next, { type: 'move', move }))
    }
    prove(newSession(level))
  })
}

test('campaign has six chapters of five distinct, legally placed puzzles', () => {
  assert.equal(chapters.length, 6)
  assert.equal(levels.length, chapters.length * LEVELS_PER_CHAPTER)
  assert.equal(new Set(levels.map((level) => level.id)).size, 30)
  const positions = new Set<string>()
  const advisorSquares = new Set([3, 5, 13, 21, 23])
  const elephantSquares = new Set([2, 6, 18, 22, 26, 38, 42])
  for (const level of levels) {
    const normal = level.board.map((piece) => piece ?? '.').join('')
    const mirrored = Array.from({ length: 10 }, (_, row) =>
      normal
        .slice(row * 9, row * 9 + 9)
        .split('')
        .reverse()
        .join(''),
    ).join('')
    const canonical = [normal, mirrored].sort()[0]
    assert.ok(!positions.has(canonical), `${level.name}: duplicate or mirrored puzzle`)
    positions.add(canonical)
    for (const side of ['red', 'black']) {
      const pieces = level.board.filter(
        (piece) =>
          piece && (side === 'red' ? piece === piece.toUpperCase() : piece === piece.toLowerCase()),
      )
      for (const [kind, max] of Object.entries({ K: 1, A: 2, B: 2, R: 2, N: 2, C: 2, P: 5 }))
        assert.ok(pieces.filter((piece) => piece!.toUpperCase() === kind).length <= max)
    }
    level.board.forEach((piece, square) => {
      if (!piece) return
      const relative = piece === piece.toUpperCase() ? 89 - square : square
      const x = relative % 9
      const y = Math.floor(relative / 9)
      if (piece.toUpperCase() === 'K') assert.ok(x >= 3 && x <= 5 && y <= 2)
      if (piece.toUpperCase() === 'A') assert.ok(advisorSquares.has(relative))
      if (piece.toUpperCase() === 'B') assert.ok(elephantSquares.has(relative))
      if (piece.toUpperCase() === 'P') assert.ok(y >= 3 && (y >= 5 || x % 2 === 0))
    })
  }
})

test('finishing a chapter unlocks its successor and legacy progress does not skip puzzles', () => {
  const firstChapter = Object.fromEntries(levels.slice(0, 5).map((level) => [level.id, 3]))
  assert.equal(unlockedLevel(firstChapter), 5)
  assert.equal(unlockedLevel({ ...firstChapter, [levels[9].id]: 3 }), 5)
  assert.equal(unlockedLevel({ 'rook-ladder': 3, 'cannon-screen': 3 }), 0)
})

test('black chooses the longest proven resistance instead of an immediate loss', () => {
  const level = levels[2]
  const first = solve(level.board, 'red', level.moves).move!
  const board = applyMove(level.board, first)
  const replies = legalMoves(board, 'black')
  assert.ok(replies.some((move) => solve(applyMove(board, move), 'red', 1).proof === 'win'))
  const response = solve(board, 'black', 2)
  assert.equal(response.proof, 'win')
  assert.ok(response.move)
  assert.equal(solve(applyMove(board, response.move), 'red', 1).proof, 'escape')
  assert.equal(solve(applyMove(board, response.move), 'red', 2).proof, 'win')
})

test('search budget exhaustion is not falsely reported as a proven escape', () => {
  assert.equal(solve(levels[7].board, 'red', 3, 0).proof, 'unknown')
})

test('black takes an available escape after a mistaken red move', () => {
  const state = sessionReducer(newSession(pursuit), { type: 'move', move: { from: 18, to: 19 } })
  assert.equal(state.phase, 'black')
  const response = solve(state.board, 'black', 1)
  assert.equal(response.proof, 'escape')
  assert.ok(response.move)
  assert.equal(solve(applyMove(state.board, response.move), 'red', 1).proof, 'escape')
})

test('undo restores a whole round, including while black is thinking', () => {
  const initial = newSession(pursuit)
  const move = solve(initial.board, 'red', 2).move!
  const pending = sessionReducer(initial, { type: 'move', move })
  assert.equal(pending.phase, 'black')
  assert.deepEqual(sessionReducer(pending, { type: 'undo' }), initial)
  const response = solve(pending.board, 'black', 1).move!
  const replied = sessionReducer(pending, { type: 'move', move: response })
  assert.equal(replied.moves, 1)
  assert.deepEqual(sessionReducer(replied, { type: 'undo' }), initial)
})

test('wrong moves fail at the budget; illegal and terminal actions are ignored', () => {
  const initial = newSession(ladder)
  assert.equal(sessionReducer(initial, { type: 'move', move: { from: 9, to: 20 } }), initial)
  const lost = sessionReducer(initial, { type: 'move', move: { from: 9, to: 10 } })
  assert.equal(lost.phase, 'lost')
  assert.equal(sessionReducer(lost, { type: 'undo' }), lost)
  assert.equal(sessionReducer(lost, { type: 'move', move: { from: 4, to: 5 } }), lost)
})

test('a black mating reply ends the challenge as a loss', () => {
  const board = position([
    ['r', 0, 7],
    ['r', 4, 8],
  ])
  const state = { ...newSession({ ...levels[5], board }), phase: 'black' as const, moves: 1 }
  const lost = sessionReducer(state, { type: 'move', move: { from: 63, to: 68 } })
  assert.equal(lost.phase, 'lost')
  assert.equal(lost.moves, 1)
  assert.match(lost.reason, /红帅被将死/)
})

test('xiangqi progress is player-scoped and ignores invalid stars', () => {
  hydratePlayerFile(playerFixture('player-a'))
  const progress = { [levels[0].id]: 3, [levels[1].id]: 2 }
  assert.equal(saveProgress('xiangqi', 'player-a', progress), true)
  assert.deepEqual(readProgress('xiangqi', 'player-a'), progress)
  assert.equal(unlockedLevel(progress), 2)
  assert.equal(unlockedLevel({ [levels[2].id]: 3 }), 0)
  assert.deepEqual(readProgress('xiangqi', 'player-b'), {})
  assert.deepEqual(readProgress('xiangqi'), {})
  assert.deepEqual(readProgress('other-game', 'player-a'), {})
  hydratePlayerFile({
    ...playerFixture('player-a'),
    games: {
      xiangqi: { progress: { [levels[0].id]: 8, [levels[1].id]: '3', unknown: 2 }, records: [] },
    },
  })
  assert.deepEqual(readProgress('xiangqi', 'player-a'), {})
  assert.equal(unlockedLevel(Object.fromEntries(levels.map((l) => [l.id, 3]))), levels.length - 1)
  assert.equal(saveProgress('xiangqi', 'unloaded-player', progress), false)
})
