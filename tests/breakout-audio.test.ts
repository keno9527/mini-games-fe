import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BreakoutAudio,
  BREAKOUT_SOUNDS,
  loadAudioSettings,
  saveAudioSettings,
} from '../src/games/breakout/audio'
import { advanceBall } from '../src/games/breakout/physics'

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

test('audio coalesces collisions, prioritizes explosions, caps voices and cancels stale playback', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string) => ({
    ok: true,
    arrayBuffer: async () => url,
  })) as typeof fetch
  const played: string[] = []
  const active = new Set<object>()
  let closed = false
  const parameter = () => ({ value: 0, setTargetAtTime() {} })
  const node = () => ({ connect() {}, disconnect() {} })
  const context = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createGain: () => ({ ...node(), gain: parameter() }),
    createDynamicsCompressor: () => ({
      ...node(),
      threshold: parameter(),
      knee: parameter(),
      ratio: parameter(),
      attack: parameter(),
      release: parameter(),
    }),
    decodeAudioData: async (bytes: unknown) => bytes,
    createBufferSource: () => {
      const source = {
        ...node(),
        buffer: '',
        onended: null,
        start() {
          played.push(source.buffer)
          active.add(source)
        },
        stop() {
          active.delete(source)
        },
      }
      return source
    },
    close: async () => {
      closed = true
    },
  }
  const audio = new BreakoutAudio(undefined, () => context as unknown as AudioContext)
  try {
    audio.unlock()
    await flush()
    audio.play('brick')
    audio.play('brick')
    await flush()
    assert.equal(played.length, 1)
    audio.play('brick')
    await flush()
    assert.equal(played.length, 1, 'cooldown prevents repeated hits')
    context.currentTime += 0.2
    audio.play('brick')
    audio.play('armor')
    audio.play('explosion')
    await flush()
    assert.equal(played.length, 2)
    assert.match(played[1], /explosion.wav$/)
    audio.stopAll()
    for (const sound of ['launch', 'paddle', 'pickup', 'multiball', 'life', 'victory'] as const)
      audio.play(sound)
    await flush()
    assert.equal(active.size, 6)
    const before = played.length
    audio.play('wall')
    await flush()
    assert.equal(played.length, before, 'low priority wall cannot interrupt important cues')
    audio.play('gameover')
    await flush()
    assert.equal(active.size, 6)
    audio.play('laser')
    audio.stopAll()
    await flush()
    assert.equal(active.size, 0)
    assert.equal(played.length, before + 1)
    audio.play('launch')
    await Promise.resolve() // scheduling has started but buffer resolution is pending
    audio.setSettings({ enabled: false, volume: 0.65 })
    await flush()
    assert.equal(active.size, 0)
    assert.equal(played.length, before + 1)
    audio.setSettings({ enabled: true, volume: 0 })
    audio.play('launch')
    await flush()
    assert.equal(active.size, 0)
    audio.dispose()
    assert.equal(closed, true)
    audio.unlock()
    audio.play('launch')
    await flush()
    assert.equal(active.size, 0)
  } finally {
    audio.dispose()
    globalThis.fetch = originalFetch
  }
})

test('missing audio support does not interrupt gameplay', async () => {
  const unavailable = new BreakoutAudio(undefined, () => {
    throw new Error('unsupported')
  })
  assert.doesNotThrow(() => {
    unavailable.unlock()
    unavailable.play('launch')
    unavailable.dispose()
  })
  assert.equal(BREAKOUT_SOUNDS.length, 18)
})

test('audio settings tolerate unavailable storage and invalid values', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let stored = '{invalid'
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value
      },
    },
  })
  try {
    assert.deepEqual(loadAudioSettings(), { enabled: true, volume: 0.65 })
    stored = '{"enabled":false,"volume":2}'
    assert.deepEqual(loadAudioSettings(), { enabled: false, volume: 1 })
    saveAudioSettings({ enabled: true, volume: 0.3 })
    assert.deepEqual(loadAudioSettings(), { enabled: true, volume: 0.3 })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('denied')
      },
    })
    assert.doesNotThrow(() => saveAudioSettings({ enabled: false, volume: 0 }))
    assert.deepEqual(loadAudioSettings(), { enabled: true, volume: 0.65 })
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('wall sounds fire only on impact without changing ball movement', () => {
  const ball = { x: 7, y: 200, vx: -5, vy: -2, r: 6, piercing: false }
  const silentBall = { ...ball }
  let impacts = 0
  advanceBall(
    ball,
    [],
    240,
    80,
    5,
    () => {},
    () => {
      impacts++
    },
  )
  advanceBall(silentBall, [], 240, 80, 5, () => {})
  assert.equal(impacts, 1)
  assert.deepEqual(ball, silentBall)
  advanceBall(
    ball,
    [],
    240,
    80,
    5,
    () => {},
    () => {
      impacts++
    },
  )
  assert.equal(impacts, 1)
})

test('failed audio requests are silent and never create playback sources', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('offline')
  }
  const parameter = { value: 0 }
  const node = { connect() {}, disconnect() {} }
  let sources = 0
  const context = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createGain: () => ({ ...node, gain: parameter }),
    createDynamicsCompressor: () => ({
      ...node,
      threshold: parameter,
      knee: parameter,
      ratio: parameter,
      attack: parameter,
      release: parameter,
    }),
    createBufferSource: () => {
      sources++
      throw new Error('must not play')
    },
    close: async () => {},
  }
  const audio = new BreakoutAudio(undefined, () => context as unknown as AudioContext)
  try {
    audio.unlock()
    audio.play('launch')
    await flush()
    assert.equal(sources, 0)
  } finally {
    audio.dispose()
    globalThis.fetch = originalFetch
  }
})
