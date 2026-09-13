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
import { levels } from '../src/games/xiangqi/levels.ts'
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
    function prove(state: ReturnType<typeof newSession>) {
      if (state.phase === 'won') return
      assert.equal(state.phase, 'red')
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

test('search budget exhaustion is not falsely reported as a proven escape', () => {
  assert.equal(solve(levels[7].board, 'red', 3, 0).proof, 'unknown')
})

test('black takes an available escape after a mistaken red move', () => {
  const state = sessionReducer(newSession(levels[2]), { type: 'move', move: { from: 18, to: 19 } })
  assert.equal(state.phase, 'black')
  const response = solve(state.board, 'black', 1)
  assert.equal(response.proof, 'escape')
  assert.ok(response.move)
  assert.equal(solve(applyMove(state.board, response.move), 'red', 1).proof, 'escape')
})

test('undo restores a whole round, including while black is thinking', () => {
  const initial = newSession(levels[2])
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
  const initial = newSession(levels[0])
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

test('progress persists separately for visitors and players, validates data, and handles storage failure', () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    },
  })
  const progress = { [levels[0].id]: 3, [levels[1].id]: 2 }
  assert.equal(saveProgress('xiangqi', 'player-a', progress), true)
  assert.deepEqual(readProgress('xiangqi', 'player-a'), progress)
  assert.equal(unlockedLevel(progress), 2)
  assert.equal(unlockedLevel({ [levels[2].id]: 3 }), 0)
  assert.deepEqual(readProgress('xiangqi', 'player-b'), {})
  assert.deepEqual(readProgress('xiangqi'), {})
  assert.deepEqual(readProgress('other-game', 'player-a'), {})
  const key = [...values.keys()][0]
  for (const raw of [
    '{broken',
    'null',
    '[]',
    '42',
    JSON.stringify({ [levels[0].id]: 8, [levels[1].id]: '3', unknown: 2 }),
  ]) {
    values.set(key, raw)
    assert.deepEqual(readProgress('xiangqi', 'player-a'), {})
  }
  assert.equal(unlockedLevel(Object.fromEntries(levels.map((l) => [l.id, 3]))), levels.length - 1)
  window.localStorage.setItem = () => {
    throw new Error('quota')
  }
  assert.equal(saveProgress('xiangqi', 'player-a', progress), false)
})
