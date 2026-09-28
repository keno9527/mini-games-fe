import test from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { PUZZLE_LEVELS, CHAPTERS } from '../src/games/gomoku/levels'
import {
  coordinate,
  initialState,
  makeBoard,
  parsePoint,
  place,
  playRound,
  solvePuzzle,
  winningLine,
  winningPoints,
  type Board,
} from '../src/games/gomoku/puzzle-engine'
import {
  completePuzzle,
  parseProgress,
  readProgress,
  readSelection,
  saveProgress,
  saveSelection,
} from '../src/games/gomoku/progression'
import { withPlayerServer } from './helpers/player-server'
import {
  commitSettlement,
  fileRequest,
  hydratePlayerFile,
  loadPlayerFile,
  readPlayerProgress,
} from '../src/api/playerFiles'
import type { PlayerFile } from '../src/features/players/schema'

// Independent directional check: does not use the engine's precomputed windows.
function wins(board: Board, side: 1 | 2): boolean {
  return board.some(
    (stone, point) =>
      stone === side &&
      [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ].some(([dx, dy]) => {
        const x = point % 15,
          y = Math.floor(point / 15)
        return [1, 2, 3, 4].every(
          (k) =>
            x + dx * k >= 0 &&
            x + dx * k < 15 &&
            y + dy * k >= 0 &&
            y + dy * k < 15 &&
            board[(y + dy * k) * 15 + x + dx * k] === side,
        )
      }),
  )
}

test('30 distinct puzzles have valid starts and genuinely increasing 1–5 move objectives', () => {
  assert.equal(CHAPTERS.length, 5)
  assert.equal(PUZZLE_LEVELS.length, 30)
  const seen = new Set<string>()
  for (const level of PUZZLE_LEVELS) {
    assert.equal(level.moves, Math.floor((level.id - 1) / 6) + 1)
    assert.equal(level.black.length, level.white.length)
    assert.equal(level.board.length, 225)
    assert.equal(wins(level.board, 1), false)
    assert.equal(wins(level.board, 2), false)
    assert.equal(seen.has(level.board.join('')), false)
    seen.add(level.board.join(''))
    assert.ok(solvePuzzle(level.board, level.moves).length, level.name)
    assert.deepEqual(
      solvePuzzle(level.board, level.moves - 1),
      [],
      `${level.name} must need the stated number of black moves`,
    )
  }
})

test('every solution withstands every white reply, not just the scripted demonstration', () => {
  let replies = 0
  const verified = new Set<string>()
  function prove(board: Board, budget: number) {
    const key = board.join('') + ':' + budget
    if (verified.has(key)) return
    verified.add(key)
    const answers = solvePuzzle(board, budget)
    assert.ok(answers.length)
    for (const move of answers) {
      const attack = place(board, move, 1)
      if (wins(attack, 1)) continue
      assert.ok(budget > 1)
      const threats = winningPoints(attack, 1)
      assert.ok(threats.length)
      for (let white = 0; white < 225; white++) {
        if (attack[white]) continue
        replies++
        const defence = place(attack, white, 2)
        assert.equal(wins(defence, 2), false, `white wins at ${coordinate(white)}`)
        const finish = threats.find((point) => !defence[point])
        if (finish !== undefined) assert.equal(wins(place(defence, finish, 1), 1), true)
        else prove(defence, budget - 1)
      }
    }
  }
  for (const level of PUZZLE_LEVELS) prove(level.board, level.moves)
  assert.ok(replies > 10_000)
  console.log(`Gomoku: verified ${replies} defensive replies across ${verified.size} positions`)
})

test('all 30 puzzles can actually be completed through the same round engine used by the UI', () => {
  const started = performance.now()
  for (const level of PUZZLE_LEVELS) {
    let state = initialState(level.board)
    for (let turn = 0; turn < level.moves; turn++) {
      const before = JSON.stringify(state)
      const point = solvePuzzle(state.board, level.moves - turn)[0]
      const next = playRound(state, point, level.moves)
      assert.equal(JSON.stringify(state), before, 'never mutate history or the original puzzle')
      state = next
      assert.notEqual(state.status, 'lost', level.name)
    }
    assert.equal(state.status, 'won', level.name)
    assert.equal(state.moves, level.moves)
    assert.ok(winningLine(state.board, 1).length)
    assert.equal(playRound(state, 0, level.moves), state, 'finished rounds ignore extra input')
  }
  console.log(`Gomoku: solve and play all 30 took ${Math.round(performance.now() - started)}ms`)
})

test('multiple solutions are accepted and defence takes precedence over attacking', () => {
  const openFour = PUZZLE_LEVELS[6]
  assert.deepEqual(solvePuzzle(openFour.board, 2).map(coordinate), ['F8', 'J8'])
  for (const point of ['F8', 'J8']) {
    const next = playRound(initialState(openFour.board), parsePoint(point), 2)
    assert.equal(next.status, 'playing')
    assert.equal(next.moves, 1)
    const finish = solvePuzzle(next.board, 1)[0]
    assert.equal(playRound(next, finish, 2).status, 'won')
  }
  const guard = PUZZLE_LEVELS[11]
  assert.deepEqual(solvePuzzle(guard.board, 2).map(coordinate), ['H8'])
  const lost = playRound(initialState(guard.board), parsePoint('H5'), 2)
  assert.equal(lost.status, 'lost')
  assert.equal(lost.lastWhite, parsePoint('H8'))
  assert.equal(wins(lost.board, 2), true)
  const race = PUZZLE_LEVELS[5]
  assert.equal(playRound(initialState(race.board), parsePoint('E8'), 1).status, 'won')
})

test('bad moves, exhausted budget, occupied cells and row boundaries are handled', () => {
  const level = PUZZLE_LEVELS[6]
  const state = initialState(level.board)
  assert.equal(playRound(state, parsePoint('H8'), 2), state)
  assert.equal(playRound(state, -1, 2), state)
  assert.equal(playRound(state, NaN, 2), state)
  assert.equal(playRound(state, parsePoint('A1'), 2).status, 'lost')
  assert.match(playRound(state, parsePoint('A1'), 2).message, /没有形成冲四/)
  assert.match(playRound(state, parsePoint('F8'), 1).message, /手已用完/)
  assert.throws(() => makeBoard(['A1'], ['A1']))
  assert.throws(() => parsePoint('P1'))
  assert.throws(() => parsePoint('A16'))
  assert.equal(wins(makeBoard(['M1', 'N1', 'O1', 'A2', 'B2'], []), 1), false)
  assert.equal(winningLine(makeBoard(['M1', 'N1', 'O1', 'A2', 'B2'], []), 1).length, 0)
  assert.equal(winningLine(makeBoard(['A1', 'B1', 'C1', 'D1', 'E1', 'F1'], []), 1).length, 5)
})

test('progress rejects corrupt data, keeps independent completions and isolates cursors', () => {
  assert.deepEqual(parseProgress(null), {})
  assert.deepEqual(parseProgress([2]), {})
  assert.deepEqual(parseProgress({ 1: 2, 2: '2', 3: 1, 31: 2 }), { 1: 2, 3: 1 })
  assert.deepEqual(completePuzzle({ 1: 2 }, 1, false), { 1: 2 })
  assert.deepEqual(completePuzzle({}, 31, true), {})
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  })
  try {
    saveSelection('gomoku', 'a', 24)
    assert.equal(readSelection('gomoku', 'a'), 24)
    assert.equal(readSelection('gomoku', 'b'), 1)
    saveSelection('gomoku', 'a', 99)
    assert.equal(readSelection('gomoku', 'a'), 1)
    saveProgress('gomoku', undefined, { 1: 2, 7: 1 })
    assert.deepEqual(readProgress('gomoku'), { 1: 2, 7: 1 })
    assert.deepEqual(readProgress('gomoku', 'b'), {})
    store.set('gomoku:puzzles:v1:guest', '{broken')
    assert.deepEqual(readProgress('gomoku'), {})
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('puzzle medals persist in player files after settlement and survive a later assisted replay', async () => {
  await withPlayerServer(async () => {
    const file = hydratePlayerFile(
      await fileRequest<PlayerFile>('', 'POST', { name: '五子棋测试' }),
    )
    const userId = file.player.id
    saveProgress('gomoku', userId, { 1: 2, 30: 1 })
    await commitSettlement({
      record: {
        id: crypto.randomUUID(),
        userId,
        gameId: 'gomoku',
        score: 100,
        level: 1,
        duration: 10,
        result: 'win',
        playedAt: new Date().toISOString(),
      },
      progress: readPlayerProgress('gomoku', userId),
    })
    hydratePlayerFile(file)
    await loadPlayerFile(userId)
    assert.deepEqual(readProgress('gomoku', userId), { 1: 2, 30: 1 })
    saveProgress('gomoku', userId, { 1: 1 })
    assert.equal(readProgress('gomoku', userId)[1], 2)
  })
})
