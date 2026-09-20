import test from 'node:test'
import assert from 'node:assert/strict'
import { TankLobby } from '../src/games/tank-battle/core/TankLobby.ts'
import type { DeviceReading } from '../src/features/gamepad/monitor.ts'

function pad(index: number, buttons: number[] = []): DeviceReading {
  return {
    index,
    id: `pad-${index}`,
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      touched: false,
      value: buttons.includes(i) ? 1 : 0,
    })),
  }
}

test('connected devices do not select coop or assign players; explicit joins fill independent slots', () => {
  const lobby = new TankLobby()
  lobby.update({ status: 'ready', devices: [pad(3), pad(8)] })
  assert.equal(lobby.mode, 'single')
  assert.equal(lobby.players.getBinding(0), null)
  assert.equal(lobby.canPlay, true)
  assert.equal(lobby.join(8), true)
  assert.equal(lobby.players.getBinding(0), 8)
  assert.equal(lobby.join(3), false)
  lobby.select('coop')
  assert.equal(lobby.canPlay, false)
  assert.equal(lobby.join(8), false)
  assert.equal(lobby.join(3), true)
  assert.equal(lobby.canPlay, true)
  assert.equal(lobby.players.getBinding(1), 3)
})

test('join input is edge-triggered; neutral input is required before gameplay and focus recovery', () => {
  const lobby = new TankLobby()
  assert.deepEqual(lobby.update({ status: 'ready', devices: [pad(0, [0])] }).actions, [
    { index: 0, action: 'confirm' },
  ])
  lobby.join(0)
  assert.equal(lobby.players.consume(0).fire, false)
  assert.equal(lobby.update({ status: 'ready', devices: [pad(0, [0])] }).actions.length, 0)
  lobby.update({ status: 'paused', devices: [] })
  assert.equal(lobby.update({ status: 'ready', devices: [pad(0, [0])] }).actions.length, 0)
  assert.equal(lobby.update({ status: 'ready', devices: [pad(0, [0])] }).actions.length, 0)
  lobby.update({ status: 'ready', devices: [pad(0)] })
  assert.equal(lobby.update({ status: 'ready', devices: [pad(0, [0])] }).actions.length, 1)
  assert.equal(lobby.players.consume(0).fire, true)
})

test('disconnect leaves the teammate in place; reconnect is explicit and keyboard fallback is single-player only', () => {
  const lobby = new TankLobby()
  lobby.select('coop')
  lobby.update({ status: 'ready', devices: [pad(0), pad(1)] })
  lobby.join(0)
  lobby.join(1)
  assert.equal(lobby.update({ status: 'ready', devices: [pad(1)] }).lostBinding, true)
  assert.equal(lobby.canPlay, false)
  assert.equal(lobby.players.getBinding(1), 1)
  lobby.useKeyboard()
  assert.equal(lobby.canPlay, false)
  lobby.update({ status: 'ready', devices: [pad(0), pad(1)] })
  assert.equal(lobby.canPlay, false)
  lobby.join(0)
  assert.equal(lobby.canPlay, true)
  lobby.select('single')
  assert.equal(lobby.players.getBinding(1), null)
  lobby.update({ status: 'waiting', devices: [] })
  assert.equal(lobby.canPlay, false)
  lobby.useKeyboard()
  assert.equal(lobby.canPlay, true)
})

test('raw-mapped controllers cannot join; reassignment clears both roles without starting play', () => {
  const lobby = new TankLobby()
  lobby.update({ status: 'ready', devices: [{ ...pad(0, [0]), mapping: '' }] })
  assert.equal(lobby.join(0), false)
  lobby.update({ status: 'ready', devices: [pad(1)] })
  lobby.join(1)
  lobby.reassign()
  assert.equal(lobby.canPlay, false)
  assert.equal(lobby.players.getBinding(0), null)
})

test('both disconnected controllers reclaim their original slots even when P2 returns first', () => {
  const lobby = new TankLobby()
  lobby.select('coop')
  lobby.update({ status: 'ready', devices: [pad(0), pad(1)] })
  lobby.join(0)
  lobby.join(1)
  lobby.update({ status: 'waiting', devices: [] })
  lobby.update({ status: 'ready', devices: [pad(1)] })
  lobby.join(1)
  assert.equal(lobby.players.getBinding(0), null)
  assert.equal(lobby.players.getBinding(1), 1)
  lobby.update({ status: 'ready', devices: [{ ...pad(7), id: 'pad-0' }, pad(1)] })
  lobby.join(7)
  assert.equal(lobby.players.getBinding(0), 7)
  assert.equal(lobby.canPlay, true)
})

test('two controllers of the same model can join and reclaim their browser-indexed slots', () => {
  const lobby = new TankLobby()
  lobby.select('coop')
  const samePad = (index: number) => ({ ...pad(index), id: 'DualSense Wireless Controller' })
  lobby.update({ status: 'ready', devices: [samePad(0), samePad(1)] })
  assert.equal(lobby.join(0), true)
  assert.equal(lobby.join(1), true)
  lobby.update({ status: 'waiting', devices: [] })
  lobby.update({ status: 'ready', devices: [samePad(1)] })
  assert.equal(lobby.join(1), true)
  assert.equal(lobby.players.getBinding(1), 1)
})
