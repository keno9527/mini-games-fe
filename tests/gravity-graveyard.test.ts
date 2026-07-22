import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRunEvent,
  gravityVector,
  integrateBody,
  predictTrajectory,
  type GravityAnchor,
  type RunState,
} from '../src/games/gravity-graveyard/engine.ts'

const pullAnchor: GravityAnchor = {
  id: 'anchor-1',
  x: 100,
  y: 0,
  mode: 'pull',
  strength: 8000,
}

test('pull anchors accelerate bodies toward the anchor', () => {
  const acceleration = gravityVector({ x: 0, y: 0 }, [pullAnchor])

  assert.ok(acceleration.x > 0)
  assert.equal(acceleration.y, 0)
})

test('repel anchors invert the gravity direction', () => {
  const acceleration = gravityVector(
    { x: 0, y: 0 },
    [{ ...pullAnchor, mode: 'repel' }],
  )

  assert.ok(acceleration.x < 0)
  assert.equal(acceleration.y, 0)
})

test('opposing anchors cancel at the midpoint', () => {
  const acceleration = gravityVector(
    { x: 0, y: 0 },
    [
      { ...pullAnchor, x: -100 },
      { ...pullAnchor, id: 'anchor-2', x: 100 },
    ],
  )

  assert.ok(Math.abs(acceleration.x) < 0.000001)
  assert.ok(Math.abs(acceleration.y) < 0.000001)
})

test('body integration caps velocity without changing heading', () => {
  const next = integrateBody(
    { x: 10, y: 20, vx: 1000, vy: 0, radius: 8 },
    [],
    1,
    320,
  )

  assert.equal(next.vx, 320)
  assert.equal(next.vy, 0)
  assert.equal(next.x, 330)
})

test('trajectory prediction does not mutate the source body', () => {
  const source = { x: 0, y: 0, vx: 40, vy: 0, radius: 5 }
  const points = predictTrajectory(source, [pullAnchor], 4, 0.1)

  assert.equal(points.length, 4)
  assert.deepEqual(source, { x: 0, y: 0, vx: 40, vy: 0, radius: 5 })
  assert.ok(points[3].x > points[0].x)
})

const activeRun: RunState = {
  phase: 'active',
  act: 1,
  ritual: 72,
  score: 1200,
  hull: 100,
  savedLives: 0,
  elapsed: 80,
  modules: [],
}

test('completing a ritual opens the interlude and awards rescued lives', () => {
  const next = applyRunEvent(activeRun, {
    type: 'stabilized',
    ritual: 30,
    score: 400,
    savedLives: 18,
  })

  assert.equal(next.phase, 'interlude')
  assert.equal(next.ritual, 100)
  assert.equal(next.score, 1600)
  assert.equal(next.savedLives, 18)
})

test('choosing a module advances to the next act without permanent stat growth', () => {
  const next = applyRunEvent(
    { ...activeRun, phase: 'interlude', ritual: 100 },
    { type: 'choose-module', moduleId: 'twin-choir' },
  )

  assert.equal(next.phase, 'active')
  assert.equal(next.act, 2)
  assert.equal(next.ritual, 0)
  assert.deepEqual(next.modules, ['twin-choir'])
  assert.equal(next.hull, activeRun.hull)
})

test('fatal hull damage ends the run immediately', () => {
  const next = applyRunEvent(
    { ...activeRun, hull: 12 },
    { type: 'damage', amount: 20 },
  )

  assert.equal(next.phase, 'defeat')
  assert.equal(next.hull, 0)
})

test('completing the third act opens the ending choice', () => {
  const next = applyRunEvent(
    { ...activeRun, act: 3, ritual: 96 },
    { type: 'stabilized', ritual: 8, score: 900, savedLives: 40 },
  )

  assert.equal(next.phase, 'ending')
  assert.equal(next.ritual, 100)
  assert.equal(next.savedLives, 40)
})
