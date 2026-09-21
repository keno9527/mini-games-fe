import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ANIMAL_META,
  applyMove,
  canCapture,
  chooseComputerMove,
  createInitialState,
  getAllLegalMoves,
  getLegalMoves,
  getMoveError,
  getOutcome,
  getPiece,
  type Animal,
  type GameState,
  type Piece,
} from '../src/games/animal-chess-ai/engine.ts'
import { getCatalogGame } from '../src/features/games/data.ts'
import { getGameManifest } from '../src/games/registry.ts'
import { addGamePlayStats, createRecord, getPlayRanking, getRecords } from '../src/api/index.ts'

const at = (x: number, y: number) => ({ x, y })
const piece = (side: Piece['side'], animal: Animal, x: number, y: number): Piece => ({
  side,
  animal,
  position: at(x, y),
})
const state = (pieces: Piece[], turn: GameState['turn'] = 'red'): GameState => ({
  pieces,
  turn,
  winner: null,
  moves: 0,
  lastMove: null,
  skippedSide: null,
})

test('AI game is registered independently from the classic local game', () => {
  assert.equal(getCatalogGame('animal-chess-ai')?.name, '斗兽棋 · 人机版')
  assert.equal(getGameManifest('animal-chess-ai')?.runtime.kind, 'embedded')
  assert.deepEqual(getCatalogGame('animal-chess')?.difficulties, ['本地双人'])
})

test('initial board has all sixteen unique pieces at classic starting positions', () => {
  const initial = createInitialState()
  assert.equal(initial.turn, 'red')
  assert.equal(initial.winner, null)
  assert.equal(initial.moves, 0)
  assert.equal(initial.pieces.length, 16)
  assert.equal(new Set(initial.pieces.map(({ position: p }) => `${p.x},${p.y}`)).size, 16)
  for (const side of ['red', 'blue'] as const) {
    assert.deepEqual(
      initial.pieces
        .filter((p) => p.side === side)
        .map((p) => p.animal)
        .sort(),
      Object.keys(ANIMAL_META).sort(),
    )
  }
  assert.deepEqual(
    initial.pieces
      .filter((p) => p.side === 'blue')
      .map((p) => [p.animal, p.position.x, p.position.y]),
    [
      ['lion', 0, 0],
      ['tiger', 6, 0],
      ['dog', 1, 1],
      ['cat', 5, 1],
      ['rat', 0, 2],
      ['leopard', 2, 2],
      ['wolf', 4, 2],
      ['elephant', 6, 2],
    ],
  )
  for (const p of initial.pieces.filter((p) => p.side === 'blue')) {
    assert.equal(getPiece(initial, at(6 - p.position.x, 8 - p.position.y))?.animal, p.animal)
  }
  initial.pieces[0].position.x = 2
  assert.equal(createInitialState().pieces[0].position.x, 0)
})

test('all animal pairs obey equal-or-stronger capture and the rat/elephant exceptions', () => {
  const animals: Animal[] = ['rat', 'cat', 'dog', 'wolf', 'leopard', 'tiger', 'lion', 'elephant']
  for (const [attackerRank, attacker] of animals.entries()) {
    for (const [defenderRank, defender] of animals.entries()) {
      const expected =
        attacker === 'rat' && defender === 'elephant'
          ? true
          : attacker === 'elephant' && defender === 'rat'
            ? false
            : attackerRank >= defenderRank
      for (const side of ['red', 'blue'] as const) {
        const attacking = piece(side, attacker, 3, 4)
        const defending = piece(side === 'red' ? 'blue' : 'red', defender, 3, 3)
        assert.equal(
          canCapture(attacking, defending),
          expected,
          `${side} ${attacker} → ${defender}`,
        )
        assert.equal(canCapture(attacking, { ...defending, side }), false)
      }
    }
  }
})

test('same-rank capture removes the defender for whichever side moves first', () => {
  for (const animal of Object.keys(ANIMAL_META) as Animal[]) {
    for (const side of ['red', 'blue'] as const) {
      const other = side === 'red' ? 'blue' : 'red'
      const game = state([piece(side, animal, 3, 4), piece(other, animal, 3, 3)], side)
      const next = applyMove(game, at(3, 4), at(3, 3))
      assert.equal(next.pieces.length, 1)
      assert.equal(getPiece(next, at(3, 3))?.side, side)
      assert.equal(next.winner, side)
    }
  }
})

test('every board square uses the same one-step movement and capture rules', () => {
  for (const animal of Object.keys(ANIMAL_META) as Animal[]) {
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 7; x++) {
        const game = state([
          piece('red', animal, x, y),
          piece('blue', 'rat', (x + 3) % 7, (y + 4) % 9),
        ])
        const expected = [at(x, y - 1), at(x + 1, y), at(x, y + 1), at(x - 1, y)].filter(
          (p) => p.x >= 0 && p.x < 7 && p.y >= 0 && p.y < 9,
        )
        assert.deepEqual(getLegalMoves(game, at(x, y)), expected)
      }
    }
  }
  const trap = state([piece('red', 'cat', 3, 6), piece('blue', 'elephant', 3, 7)])
  assert.ok(getMoveError(trap, at(3, 6), at(3, 7)))
  const riverBank = state([piece('red', 'rat', 0, 3), piece('blue', 'elephant', 1, 3)])
  assert.equal(getMoveError(riverBank, at(0, 3), at(1, 3)), null)
})

test('den entry is an ordinary move, not a win, and lions cannot jump', () => {
  const game = state([piece('red', 'lion', 3, 1), piece('blue', 'rat', 6, 6)])
  assert.equal(applyMove(game, at(3, 1), at(3, 0)).winner, null)
  const lion = state([piece('red', 'lion', 1, 2), piece('blue', 'rat', 6, 6)])
  assert.ok(getMoveError(lion, at(1, 2), at(1, 6)))
})

test('illegal inputs preserve board identity, turn, and move count with an explanation', () => {
  const game = state([
    piece('red', 'cat', 0, 0),
    piece('red', 'rat', 0, 1),
    piece('blue', 'dog', 1, 0),
  ])
  const snapshot = structuredClone(game)
  for (const [from, to] of [
    [at(0, 0), at(-1, 0)],
    [at(0, 0), at(1, 1)],
    [at(0, 0), at(0, 2)],
    [at(0, 0), at(0, 1)],
    [at(0, 0), at(1, 0)],
    [at(2, 2), at(2, 3)],
    [at(1, 0), at(2, 0)],
    [at(0, 0), at(0.5, 0.5)],
  ]) {
    assert.ok(getMoveError(game, from, to))
    assert.equal(applyMove(game, from, to), game)
  }
  assert.deepEqual(game, snapshot)
})

test('legal moves are immutable, capture once, alternate turns, and lock after elimination', () => {
  const game = state([
    piece('red', 'dog', 3, 4),
    piece('blue', 'cat', 3, 3),
    piece('blue', 'rat', 6, 6),
  ])
  const snapshot = structuredClone(game)
  const next = applyMove(game, at(3, 4), at(3, 3))
  assert.deepEqual(game, snapshot)
  assert.equal(next.turn, 'blue')
  assert.equal(next.moves, 1)
  assert.equal(next.pieces.length, 2)
  assert.deepEqual(next.lastMove, { from: at(3, 4), to: at(3, 3) })
  const ending = state([piece('red', 'dog', 3, 4), piece('blue', 'cat', 3, 3)])
  const finished = applyMove(ending, at(3, 4), at(3, 3))
  assert.equal(finished.winner, 'red')
  assert.deepEqual(getAllLegalMoves(finished), [])
  assert.equal(applyMove(finished, at(3, 3), at(3, 2)), finished)
  assert.equal(chooseComputerMove(finished), null)
})

test('blocked opponent skips a turn without being declared defeated', () => {
  for (const side of ['red', 'blue'] as const) {
    const blocked = side === 'red' ? 'blue' : 'red'
    const game = state(
      [piece(blocked, 'rat', 0, 0), piece(side, 'cat', 1, 0), piece(side, 'dog', 1, 1)],
      side,
    )
    const next = applyMove(game, at(1, 1), at(0, 1))
    assert.equal(next.winner, null)
    assert.equal(next.turn, side)
    assert.equal(next.skippedSide, blocked)
    assert.ok(getAllLegalMoves(next).length)
  }
})

test('computer prefers a legal capture, randomizes candidates, and never moves for the player', () => {
  const game = state(
    [piece('blue', 'dog', 3, 4), piece('red', 'cat', 3, 3), piece('red', 'dog', 4, 4)],
    'blue',
  )
  assert.deepEqual(
    chooseComputerMove(game, () => 0),
    { from: at(3, 4), to: at(3, 3) },
  )
  assert.deepEqual(
    chooseComputerMove(game, () => 0.999),
    { from: at(3, 4), to: at(4, 4) },
  )
  assert.equal(chooseComputerMove(createInitialState()), null)
  const noCapture = state([piece('blue', 'cat', 3, 4), piece('red', 'elephant', 3, 3)], 'blue')
  for (const random of [0, 0.25, 0.5, 0.999]) {
    const move = chooseComputerMove(noCapture, () => random)
    assert.ok(move)
    assert.equal(getMoveError(noCapture, move.from, move.to), null)
  }
  assert.equal(
    chooseComputerMove(
      state(
        [piece('blue', 'rat', 0, 0), piece('red', 'cat', 1, 0), piece('red', 'dog', 0, 1)],
        'blue',
      ),
    ),
    null,
  )
})

test('seeded playouts preserve legal turns, unique positions, and complete armies minus captures', () => {
  let seed = 42
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
  for (let round = 0; round < 10; round++) {
    let game = createInitialState()
    for (let step = 0; step < 300 && !game.winner; step++) {
      const moves = getAllLegalMoves(game)
      assert.ok(moves.length)
      const move =
        game.turn === 'blue'
          ? chooseComputerMove(game, random)!
          : moves[Math.floor(random() * moves.length)]
      assert.equal(getMoveError(game, move.from, move.to), null)
      const next = applyMove(game, move.from, move.to)
      assert.equal(next.moves, game.moves + 1)
      assert.equal(
        new Set(next.pieces.map((p) => `${p.position.x},${p.position.y}`)).size,
        next.pieces.length,
      )
      assert.ok(
        next.pieces.length === game.pieces.length || next.pieces.length === game.pieces.length - 1,
      )
      game = next
    }
  }
})

test('outcomes always use the human red side for win/lose and scoring', () => {
  assert.deepEqual(getOutcome('red'), { result: 'win', score: 100 })
  assert.deepEqual(getOutcome('blue'), { result: 'lose', score: 0 })
})

test('personal scores persist separately from anonymous game totals', async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const storage = new Map<string, string>([
    ['mini-games-local-users', JSON.stringify([{ id: 'ai-test-player', name: '测试玩家' }])],
  ])
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  })
  try {
    for (const winner of ['red', 'blue'] as const) {
      await createRecord('ai-test-player', {
        gameId: 'animal-chess-ai',
        duration: 90,
        ...getOutcome(winner),
      })
    }
    await createRecord('ai-test-player', {
      gameId: 'animal-chess',
      duration: 30,
      score: 100,
      result: 'complete',
    })
    const records = await getRecords('ai-test-player')
    assert.deepEqual(
      records
        .filter((r) => r.gameId === 'animal-chess-ai')
        .map((r) => [r.result, r.score, r.duration]),
      [
        ['win', 100, 90],
        ['lose', 0, 90],
      ],
    )
    assert.deepEqual(await getPlayRanking(), [])
    addGamePlayStats('animal-chess-ai', { playCount: 2, totalDuration: 180 })
    addGamePlayStats('animal-chess', { playCount: 1, totalDuration: 30 })
    const ranking = await getPlayRanking()
    assert.equal(ranking.find((r) => r.gameId === 'animal-chess-ai')?.playCount, 2)
    assert.equal(ranking.find((r) => r.gameId === 'animal-chess')?.playCount, 1)
    assert.equal(records.length, 3)
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  }
})
