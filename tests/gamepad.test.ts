import test from 'node:test'
import assert from 'node:assert/strict'
import {
  monitorGamepads,
  readDevices,
  STANDARD_BUTTON_NAMES,
  type GamepadPlatform,
  type MonitorSnapshot,
} from '../src/features/gamepad/monitor.ts'

function device(overrides: Partial<Gamepad> = {}): Gamepad {
  return {
    id: 'USB test controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0],
    buttons: [{ pressed: false, touched: false, value: 0 }],
    vibrationActuator: null,
    ...overrides,
  } as Gamepad
}

function harness(overrides: Partial<GamepadPlatform> = {}) {
  let pads: Array<Gamepad | null> = []
  let active = true
  let fail = false
  let eventListener: (() => void) | undefined
  let frameCallback: ((time: number) => void) | undefined
  let reads = 0
  let subscriptions = 0
  let unsubscriptions = 0
  let cancellations = 0
  const snapshots: MonitorSnapshot[] = []
  const platform: GamepadPlatform = {
    secure: true,
    supported: true,
    active: () => active,
    read() {
      reads += 1
      if (fail) throw new Error('Access denied')
      return pads
    },
    subscribe(listener) {
      subscriptions += 1
      eventListener = listener
      return () => {
        unsubscriptions += 1
        eventListener = undefined
      }
    },
    requestFrame(callback) {
      frameCallback = callback
      return 42
    },
    cancelFrame(id) {
      assert.equal(id, 42)
      cancellations += 1
      frameCallback = undefined
    },
    ...overrides,
  }
  const dispose = monitorGamepads(platform, (snapshot) => snapshots.push(snapshot))
  return {
    snapshots,
    dispose,
    setPads(next: Array<Gamepad | null>) {
      pads = next
      eventListener?.()
    },
    setActive(next: boolean) {
      active = next
      eventListener?.()
    },
    setFailure(next: boolean) {
      fail = next
      eventListener?.()
    },
    frame(time: number) {
      frameCallback?.(time)
    },
    get reads() {
      return reads
    },
    get subscriptions() {
      return subscriptions
    },
    get unsubscriptions() {
      return unsubscriptions
    },
    get cancellations() {
      return cancellations
    },
    get latest() {
      return snapshots.at(-1)!
    },
  }
}

test('copies standard and raw controls without dropping extra buttons or an unpaired axis', () => {
  const buttons = Array.from({ length: 19 }, (_, index) => ({
    pressed: index === 18,
    touched: index === 1 || index === 18,
    value: index === 18 ? 0.7598 : 0,
  }))
  const pads = [
    null,
    device({ index: 1, buttons }),
    device({ index: 2, mapping: '', axes: [-1, 0.12345, 0.8] }),
  ]
  const result = readDevices(pads)
  assert.deepEqual(
    result.map((pad) => pad.index),
    [1, 2],
  )
  assert.equal(result[0].buttons.length, 19)
  assert.deepEqual(result[0].buttons[18], { pressed: true, touched: true, value: 0.76 })
  assert.equal(result[0].buttons[1].touched, true)
  assert.equal(result[1].mapping, '')
  assert.deepEqual(result[1].axes, [-1, 0.123, 0.8])
  assert.match(STANDARD_BUTTON_NAMES[12], /↑/)
  buttons[18].value = 0
  assert.equal(
    result[0].buttons[18].value,
    0.76,
    'readings must not reference live browser objects',
  )
})

test('ignores disconnected slots and bounds malformed numeric input', () => {
  assert.deepEqual(readDevices([device({ connected: false }), null]), [])
  const result = readDevices([device({ axes: [NaN, Infinity, -5, 6] })])
  assert.deepEqual(result[0].axes, [0, 0, -1, 1])
})

test('tracks multiple connections, disconnects and replacement devices at reused indexes', () => {
  const monitor = harness()
  assert.equal(monitor.latest.status, 'waiting')
  monitor.setPads([device(), null, device({ index: 2, mapping: '' })])
  assert.equal(monitor.latest.status, 'ready')
  assert.deepEqual(
    monitor.latest.devices.map((pad) => pad.index),
    [0, 2],
  )
  monitor.setPads([null, null, device({ index: 2 })])
  assert.deepEqual(
    monitor.latest.devices.map((pad) => pad.index),
    [2],
  )
  monitor.setPads([])
  assert.deepEqual(monitor.latest, { status: 'waiting', devices: [] })
  monitor.setPads([device({ id: 'Replacement' })])
  assert.equal(monitor.latest.devices[0].id, 'Replacement')
  monitor.dispose()
})

test('clears readings while inactive and restores current data on return', () => {
  const monitor = harness()
  monitor.setPads([device({ axes: [1, -1] })])
  monitor.setActive(false)
  assert.deepEqual(monitor.latest, { status: 'paused', devices: [] })
  const readsBefore = monitor.reads
  monitor.frame(100)
  assert.equal(monitor.reads, readsBefore)
  monitor.setPads([device({ axes: [0, 0] })])
  monitor.setActive(true)
  assert.deepEqual(monitor.latest.devices[0].axes, [0, 0])
  monitor.dispose()
})

test('reports access exceptions instead of disconnected and recovers on later reads', () => {
  const monitor = harness()
  monitor.setPads([device()])
  monitor.setFailure(true)
  assert.deepEqual(monitor.latest, { status: 'error', devices: [] })
  monitor.setFailure(false)
  assert.equal(monitor.latest.status, 'ready')
  monitor.dispose()
})

test('unsafe and unsupported platforms never read, subscribe or start polling', () => {
  for (const [overrides, status] of [
    [{ secure: false }, 'insecure'],
    [{ supported: false }, 'unsupported'],
  ] as const) {
    const monitor = harness(overrides)
    assert.deepEqual(monitor.latest, { status, devices: [] })
    assert.equal(monitor.reads, 0)
    assert.equal(monitor.subscriptions, 0)
    monitor.frame(100)
    assert.equal(monitor.snapshots.length, 1)
    monitor.dispose()
    assert.equal(monitor.cancellations, 0)
  }
})

test('reads every frame, publishes only changes and releases subscriptions on disposal', () => {
  const monitor = harness()
  monitor.setPads([device()])
  const notifications = monitor.snapshots.length
  monitor.frame(100)
  const readsBefore = monitor.reads
  monitor.frame(120)
  assert.equal(monitor.reads, readsBefore + 1)
  monitor.frame(150)
  assert.equal(monitor.reads, readsBefore + 2)
  assert.equal(monitor.snapshots.length, notifications)
  monitor.dispose()
  assert.equal(monitor.unsubscriptions, 1)
  assert.equal(monitor.cancellations, 1)
  monitor.dispose()
  assert.equal(monitor.unsubscriptions, 1)
  monitor.setPads([])
  monitor.frame(200)
  assert.equal(monitor.snapshots.length, notifications)
})
