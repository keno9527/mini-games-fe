import test from 'node:test'
import assert from 'node:assert/strict'
import { GamepadPlayers, idleControls } from '../src/features/gamepad/players.ts'
import type { DeviceReading } from '../src/features/gamepad/monitor.ts'

function pad(index: number, buttons: number[] = [], axes = [0, 0]): DeviceReading {
  return {
    index,
    id: `controller-${index}`,
    mapping: 'standard',
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      touched: false,
      value: buttons.includes(i) ? 1 : 0,
    })),
  }
}

test('single player excludes P2; two players receive independent controls without duplicate bindings', () => {
  const players = new GamepadPlayers()
  players.update({ status: 'ready', devices: [pad(2), pad(5)] })
  assert.equal(players.bind(0, 2), true)
  assert.equal(players.bind(1, 5), false)
  players.setPlayerCount(2)
  assert.equal(players.bind(1, 2), false)
  assert.equal(players.bind(1, 5), true)
  players.update({ status: 'ready', devices: [pad(2), pad(5)] })
  players.update({ status: 'ready', devices: [pad(2, [14]), pad(5, [0], [0.9, 0])] })
  assert.equal(players.consume(0).left, true)
  assert.equal(players.consume(0).fire, false)
  const p2 = players.consume(1)
  assert.equal(p2.right, true)
  assert.equal(p2.fire, true)
  assert.equal(p2.confirmEdge, true)
  assert.equal(players.consume(1).confirmEdge, false)
  players.setPlayerCount(1)
  assert.equal(players.getBinding(1), null)
  assert.deepEqual(players.consume(1), idleControls())
})

test('disconnect does not transfer the other player, and a reused index needs rebinding', () => {
  const players = new GamepadPlayers()
  players.setPlayerCount(2)
  players.update({ status: 'ready', devices: [pad(0), pad(1)] })
  players.bind(0, 0)
  players.bind(1, 1)
  players.update({ status: 'ready', devices: [pad(0), pad(1)] })
  players.update({ status: 'ready', devices: [pad(1, [0])] })
  assert.equal(players.getBinding(0), null)
  assert.equal(players.getBinding(1), 1)
  assert.deepEqual(players.consume(0), idleControls())
  players.update({ status: 'ready', devices: [pad(0, [0]), pad(1)] })
  assert.deepEqual(players.consume(0), idleControls())
  players.update({ status: 'ready', devices: [{ ...pad(1), id: 'replacement' }] })
  assert.equal(players.getBinding(1), null)
})

test('binding and returning from background require neutral input; axis drift is ignored', () => {
  const players = new GamepadPlayers()
  players.update({ status: 'ready', devices: [pad(0, [0])] })
  players.bind(0, 0)
  players.update({ status: 'ready', devices: [pad(0, [0])] })
  assert.deepEqual(players.consume(0), idleControls())
  players.update({ status: 'ready', devices: [pad(0, [], [0.1, -0.2])] })
  players.update({ status: 'ready', devices: [pad(0, [9])] })
  assert.equal(players.consume(0).pauseEdge, true)
  players.update({ status: 'ready', devices: [pad(0, [9])] })
  assert.equal(players.consume(0).pauseEdge, false)
  players.update({ status: 'paused', devices: [] })
  assert.deepEqual(players.consume(0), idleControls())
  assert.equal(players.getBinding(0), 0)
  players.update({ status: 'ready', devices: [pad(0, [9])] })
  assert.deepEqual(players.consume(0), idleControls())
  players.update({ status: 'ready', devices: [pad(0)] })
  players.update({ status: 'ready', devices: [pad(0, [9])] })
  assert.equal(players.consume(0).pauseEdge, true)
})

test('raw layouts cannot be bound and API errors release held input', () => {
  const players = new GamepadPlayers()
  players.update({ status: 'ready', devices: [{ ...pad(0), mapping: '' }] })
  assert.equal(players.bind(0, 0), false)
  players.update({ status: 'ready', devices: [pad(0)] })
  players.bind(0, 0)
  players.update({ status: 'ready', devices: [pad(0)] })
  players.update({ status: 'ready', devices: [pad(0, [0])] })
  assert.equal(players.consume(0).fire, true)
  players.update({ status: 'error', devices: [] })
  assert.deepEqual(players.consume(0), idleControls())
})
