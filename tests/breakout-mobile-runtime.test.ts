import test from 'node:test'
import assert from 'node:assert/strict'
import { mountMobileGame } from '../src/games/breakout-mobile/runtime.ts'
import { MobileGame } from '../src/games/breakout-mobile/game.ts'
import { MobileSave } from '../src/games/breakout-mobile/storage.ts'
import { MobileAudio } from '../src/games/breakout-mobile/audio.ts'

class Events extends EventTarget {
  count = 0
  interactive = false
  closest() {
    return this.interactive ? this : null
  }
  override addEventListener(...args: Parameters<EventTarget['addEventListener']>) {
    this.count++
    super.addEventListener(...args)
  }
  override removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) {
    this.count--
    super.removeEventListener(...args)
  }
}

function mockGlobals(values: Record<string, unknown>) {
  const originals = Object.fromEntries(
    Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  )
  for (const [key, value] of Object.entries(values))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  return () => {
    for (const [key, original] of Object.entries(originals)) {
      if (original) Object.defineProperty(globalThis, key, original)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test('mobile lifecycle pauses on background/rotation and restores global layout, pointers and listeners', () => {
  const orientation = Object.assign(new Events(), { matches: false })
  const visible = Object.assign(new Events(), { height: 700, offsetTop: 0, scale: 1 })
  let restoredScroll: number[] = []
  const win = Object.assign(new Events(), {
    innerHeight: 700,
    devicePixelRatio: 3,
    scrollX: 0,
    scrollY: 120,
    visualViewport: visible,
    matchMedia: () => orientation,
    scrollTo: (x: number, y: number) => {
      restoredScroll = [x, y]
    },
  })
  const viewport = {
    content: 'width=device-width, initial-scale=1',
    getAttribute() {
      return this.content
    },
  }
  const doc = Object.assign(new Events(), {
    hidden: false,
    querySelector: () => viewport,
    documentElement: { style: { overflow: 'clip' } },
    body: { style: { overflow: '', overscrollBehavior: 'auto' } },
  })
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  let disconnected = false
  const restore = mockGlobals({
    Element: Events,
    window: win,
    document: doc,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    ResizeObserver: class {
      observe() {}
      disconnect() {
        disconnected = true
      }
    },
  })
  const attributes = new Map<string, string>()
  const pointers = new Set<number>()
  const classes = new Set<string>()
  const pad = Object.assign(new Events(), {
    setAttribute: (key: string, value: string) => attributes.set(key, value),
    setPointerCapture: (id: number) => pointers.add(id),
    hasPointerCapture: (id: number) => pointers.has(id),
    releasePointerCapture: (id: number) => pointers.delete(id),
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
  })
  const ctx = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {},
    },
  )
  const canvas = {
    width: 960,
    height: 1040,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 300 }),
  }
  const game = new MobileGame()
  const save = new MobileSave(() => ({ getItem: () => null, setItem() {} }))
  save.data.audio.enabled = false
  let session: ReturnType<typeof mountMobileGame> | undefined
  let learned = 0
  try {
    session = mountMobileGame(
      {
        root: { style: { setProperty() {} } } as unknown as HTMLElement,
        stage: { clientWidth: 300, clientHeight: 400 } as HTMLElement,
        canvas: canvas as unknown as HTMLCanvasElement,
        controls: pad as unknown as HTMLElement,
      },
      game,
      save,
      {
        update() {},
        landscape() {},
        audioError() {},
        dragged() {
          learned++
        },
      },
    )
    assert.match(viewport.content, /viewport-fit=cover/)
    assert.equal(doc.body.style.overflow, 'hidden')
    assert.equal(canvas.width, 600, 'render pixel ratio is capped at two')
    pad.interactive = true
    pad.dispatchEvent(
      Object.assign(new Event('pointerdown'), { button: 0, pointerId: 2, clientX: 100 }),
    )
    assert.equal(pointers.size, 0, 'buttons and menu controls never begin a paddle drag')
    pad.interactive = false
    pad.dispatchEvent(
      Object.assign(new Event('pointerdown'), { button: 0, pointerId: 3, clientX: 100 }),
    )
    assert.equal(pointers.size, 1)
    assert.equal(game.paddleX, 240, 'touch down never teleports the paddle')
    assert.equal(game.status, 'ready', 'touch down never launches')
    pad.dispatchEvent(Object.assign(new Event('pointermove'), { pointerId: 3, clientX: 100 }))
    assert.equal(learned, 0, 'a stationary touch does not dismiss onboarding')
    pad.dispatchEvent(
      Object.assign(new Event('pointerdown'), { button: 0, pointerId: 4, clientX: 180 }),
    )
    pad.dispatchEvent(Object.assign(new Event('pointermove'), { pointerId: 4, clientX: 280 }))
    assert.equal(game.paddleX, 240, 'a second finger cannot take control')
    pad.dispatchEvent(Object.assign(new Event('pointermove'), { pointerId: 3, clientX: 130 }))
    assert.equal(game.paddleX, 288)
    assert.equal(learned, 1)
    assert.equal(game.status, 'ready', 'dragging cannot launch')
    pad.dispatchEvent(Object.assign(new Event('pointercancel'), { pointerId: 3 }))
    assert.equal(pointers.size, 0)
    pad.dispatchEvent(Object.assign(new Event('pointermove'), { pointerId: 3, clientX: 150 }))
    assert.equal(game.paddleX, 288, 'cancelled pointers cannot leave a residual drag')
    session.pause()
    session.settings(true)
    session.settings(false)
    session.resume()
    assert.equal(
      game.status,
      'ready',
      'closing settings and continuing a ready game never launches',
    )
    session.launch()
    pad.dispatchEvent(
      Object.assign(new Event('pointerdown'), { button: 0, pointerId: 5, clientX: 100 }),
    )
    pad.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 5 }))
    assert.equal(game.status, 'playing', 'lifting a finger does not pause')
    pad.dispatchEvent(
      Object.assign(new Event('pointerdown'), { button: 0, pointerId: 6, clientX: 100 }),
    )
    pad.dispatchEvent(Object.assign(new Event('lostpointercapture'), { pointerId: 6 }))
    assert.equal(pointers.size, 0)
    assert.equal(frames.size, 1)
    doc.hidden = true
    doc.dispatchEvent(new Event('visibilitychange'))
    assert.equal(game.status, 'paused')
    assert.equal(frames.size, 0)
    const frozen = JSON.stringify(game.snapshot())
    pad.dispatchEvent(
      Object.assign(new Event('pointerdown'), { button: 0, pointerId: 7, clientX: 100 }),
    )
    pad.dispatchEvent(Object.assign(new Event('keydown'), { key: 'ArrowRight' }))
    game.frame(90000)
    assert.equal(pointers.size, 0, 'paused input cannot capture pointers')
    assert.equal(JSON.stringify(game.snapshot()), frozen)
    doc.hidden = false
    doc.dispatchEvent(new Event('visibilitychange'))
    assert.equal(game.status, 'paused', 'foreground never resumes automatically')
    orientation.matches = true
    orientation.dispatchEvent(new Event('change'))
    session.resume()
    assert.equal(game.status, 'paused', 'landscape cannot resume')
    orientation.matches = false
    orientation.dispatchEvent(new Event('change'))
    assert.equal(game.status, 'paused')
    session.resume()
    assert.equal(game.status, 'playing')
    session.settings(true)
    session.resume()
    assert.equal(game.status, 'paused', 'a settings sheet gates gameplay')
    session.settings(false)
    assert.equal(game.status, 'paused', 'returning from settings stays paused')
    session.resume()
    assert.equal(game.status, 'playing', 'continuing resumes immediately with no countdown')
    assert.equal(frames.size, 1)
    session.destroy()
    session = undefined
    assert.equal(frames.size, 0)
    assert.equal(disconnected, true)
    assert.equal(doc.body.style.overflow, '')
    assert.equal(doc.documentElement.style.overflow, 'clip')
    assert.equal(doc.body.style.overscrollBehavior, 'auto')
    assert.equal(viewport.content, 'width=device-width, initial-scale=1')
    assert.deepEqual(restoredScroll, [0, 120])
    assert.deepEqual(
      [win.count, doc.count, visible.count, orientation.count, pad.count],
      [0, 0, 0, 0, 0],
    )
  } finally {
    session?.destroy()
    restore()
  }
})

test('mobile audio recovers an interrupted context on a new gesture without changing desktop audio', async () => {
  const contexts: FakeContext[] = []
  const parameter = () => ({ value: 0, setTargetAtTime() {} })
  const node = () => ({ connect() {}, disconnect() {} })
  class FakeContext {
    state = 'suspended'
    destination = {}
    currentTime = 0
    failResume = false
    constructor() {
      contexts.push(this)
    }
    createGain() {
      return { ...node(), gain: parameter() }
    }
    createDynamicsCompressor() {
      return {
        ...node(),
        threshold: parameter(),
        knee: parameter(),
        ratio: parameter(),
        attack: parameter(),
        release: parameter(),
      }
    }
    decodeAudioData() {
      return Promise.resolve({})
    }
    async resume() {
      if (this.failResume) throw new Error('Interrupted')
      this.state = 'running'
    }
    async suspend() {
      this.state = 'suspended'
    }
    async close() {
      this.state = 'closed'
    }
  }
  const restore = mockGlobals({
    window: { AudioContext: FakeContext },
    fetch: async () => ({ ok: false }),
  })
  const messages: string[] = []
  const audio = new MobileAudio({ enabled: true, volume: 0.65 }, (message) =>
    messages.push(message),
  )
  try {
    assert.equal(contexts.length, 0, 'audio is not created before a gesture')
    audio.unlock()
    assert.equal(contexts[0].state, 'running')
    contexts[0].state = 'interrupted'
    contexts[0].failResume = true
    audio.unlock()
    await Promise.resolve()
    await Promise.resolve()
    assert.match(messages.at(-1)!, /重新开启/)
    audio.unlock()
    assert.equal(contexts.length, 2)
    assert.equal(contexts[0].state, 'closed')
    assert.equal(contexts[1].state, 'running')
    audio.suspend()
    assert.equal(contexts[1].state, 'suspended')
    audio.dispose()
    assert.equal(contexts[1].state, 'closed')
    const count = messages.length
    audio.unlock()
    await Promise.resolve()
    assert.equal(contexts.length, 2)
    assert.equal(messages.length, count, 'disposed players cannot publish late failures')
  } finally {
    audio.dispose()
    restore()
  }
})
