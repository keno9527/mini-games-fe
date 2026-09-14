import test from 'node:test'
import assert from 'node:assert/strict'

import {
  reflect,
  starsFor,
  traceLaser,
  type Direction,
  type LaserLevel,
  type MirrorOrientation,
} from '../src/games/laser-mirror/engine.ts'
import { LASER_LEVELS } from '../src/games/laser-mirror/levels.ts'
import { recordCompletion } from '../src/games/laser-mirror/progression.ts'

const reflections: Array<[MirrorOrientation, Direction, Direction]> = [
  ['/', 'N', 'E'],
  ['/', 'E', 'N'],
  ['/', 'S', 'W'],
  ['/', 'W', 'S'],
  ['\\', 'N', 'W'],
  ['\\', 'W', 'N'],
  ['\\', 'S', 'E'],
  ['\\', 'E', 'S'],
]

test('both mirrors reflect all four incoming directions', () => {
  for (const [mirror, incoming, outgoing] of reflections) {
    assert.equal(reflect(incoming, mirror), outgoing)
  }
})

test('all handcrafted solutions light every crystal', () => {
  for (const level of LASER_LEVELS) {
    const solvedMirrors = level.mirrors.map((mirror, index) => ({
      ...mirror,
      orientation: level.solution[index],
    }))
    assert.equal(traceLaser(level, solvedMirrors).solved, true, level.id)
  }
})

test('walls absorb beams before crystals behind them', () => {
  const level: LaserLevel = {
    id: 'wall',
    name: 'wall',
    difficulty: '简单',
    description: '',
    rows: 1,
    cols: 4,
    par: 1,
    emitters: [{ row: 0, col: 0, direction: 'E' }],
    mirrors: [],
    solution: [],
    walls: [{ row: 0, col: 2 }],
    crystals: [{ row: 0, col: 3 }],
  }

  assert.equal(traceLaser(level).solved, false)
})

test('splitters create a straight and clockwise branch', () => {
  const level: LaserLevel = {
    id: 'split',
    name: 'split',
    difficulty: '复杂',
    description: '',
    rows: 3,
    cols: 3,
    par: 0,
    emitters: [{ row: 2, col: 1, direction: 'N' }],
    mirrors: [],
    solution: [],
    splitters: [{ row: 1, col: 1 }],
    crystals: [
      { row: 0, col: 1 },
      { row: 1, col: 2 },
    ],
  }

  assert.equal(traceLaser(level).solved, true)
})

test('visited beam states make loops converge', () => {
  const level: LaserLevel = {
    id: 'loop',
    name: 'loop',
    difficulty: '复杂',
    description: '',
    rows: 3,
    cols: 3,
    par: 0,
    emitters: [{ row: 1, col: 1, direction: 'N' }],
    mirrors: [
      { row: 0, col: 1, orientation: '\\' },
      { row: 0, col: 0, orientation: '/' },
      { row: 1, col: 0, orientation: '\\' },
      { row: 1, col: 1, orientation: '/' },
    ],
    solution: ['\\', '/', '\\', '/'],
    crystals: [{ row: 2, col: 2 }],
  }

  assert.ok(traceLaser(level).edges.length < 20)
})

test('star thresholds and hint cap follow the product rule', () => {
  assert.equal(starsFor(3, 3), 3)
  assert.equal(starsFor(5, 3), 2)
  assert.equal(starsFor(6, 3), 1)
  assert.equal(starsFor(1, 3, true), 1)
})

test('completion unlocks the next level and preserves the best result', () => {
  const first = recordCompletion({ unlocked: 1, results: {} }, 'easy-1', 0, 4, 2, 9)
  const improved = recordCompletion(first, 'easy-1', 0, 2, 3, 9)
  const worse = recordCompletion(improved, 'easy-1', 0, 7, 1, 9)

  assert.equal(worse.unlocked, 2)
  assert.deepEqual(worse.results['easy-1'], { stars: 3, bestMoves: 2 })
})
