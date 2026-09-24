import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mountTankBattle,
  type TankBattleControllers,
  type TankBattleMenu,
  type TankBattleUiState,
} from '../src/games/tank-battle/runtime.ts'
import { loadProgress, saveProgress } from '../src/games/tank-battle/progress.ts'

function pad(index: number, buttons: number[] = []): Gamepad {
  return {
    index,
    id: `pad-${index}`,
    mapping: 'standard',
    connected: true,
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      touched: false,
      value: buttons.includes(i) ? 1 : 0,
    })),
  } as Gamepad
}

for (const campaignId of ['battle-city', 'tank-a'] as const) {
  test(`${campaignId} runtime starts selected modes and preserves reconnection, practice and progress`, () => {
    const lastStage = campaignId === 'tank-a' ? 49 : 34
    const initialProgress = campaignId === 'tank-a' ? 48 : 4
    const globals = [
      'window',
      'document',
      'navigator',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ] as const
    const originals = globals.map(
      (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
    )
    const callbacks = new Map<number, FrameRequestCallback>()
    let sequence = 0
    let now = performance.now()
    let pads: Gamepad[] = []
    const install = (key: string, value: unknown) =>
      Object.defineProperty(globalThis, key, { configurable: true, value })
    install(
      'window',
      Object.assign(new EventTarget(), {
        isSecureContext: true,
        innerWidth: 1200,
        innerHeight: 900,
      }),
    )
    install('document', Object.assign(new EventTarget(), { hidden: false, hasFocus: () => true }))
    install('navigator', { getGamepads: () => pads })
    install('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++sequence, callback)
      return sequence
    })
    install('cancelAnimationFrame', (id: number) => callbacks.delete(id))
    const context = new Proxy(
      {},
      {
        get: (_, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => {}),
        set: () => true,
      },
    )
    const canvas = Object.assign(new EventTarget(), {
      style: {},
      getContext: () => context,
    }) as unknown as HTMLCanvasElement
    const stage = { clientWidth: 1000, getBoundingClientRect: () => ({ top: 100 }) } as HTMLElement
    let state: TankBattleUiState = 'title'
    let controllers: TankBattleControllers | undefined
    let menu: TankBattleMenu | undefined
    const campaignChanges: string[] = []
    const saved = new Map<string, string>()
    const storage = {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => {
        saved.set(key, value)
      },
    }
    saveProgress(initialProgress, undefined, storage, campaignId)
    const mount = () =>
      mountTankBattle(canvas, stage, {
        onCampaignChange: (next) => campaignChanges.push(next),
        campaignId,
        initialProgress: {
          single: loadProgress(undefined, storage, campaignId, 'single'),
          coop: loadProgress(undefined, storage, campaignId, 'coop'),
        },
        onStageReached: (stage, mode) => saveProgress(stage, undefined, storage, campaignId, mode),
        onStateChange: (next) => {
          state = next
        },
        onControllersChange: (next) => {
          controllers = next
        },
        onMenuChange: (next) => {
          menu = next
        },
      })
    let handle = mount()
    const frames = (count = 4) => {
      for (let i = 0; i < count; i++) {
        now += 17
        const scheduled = [...callbacks.values()]
        callbacks.clear()
        scheduled.forEach((callback) => callback(now))
      }
    }
    const send = (...next: Gamepad[]) => {
      pads = next
      frames()
    }
    try {
      handle.menuAction('right')
      assert.deepEqual(campaignChanges, [campaignId === 'tank-a' ? 'battle-city' : 'tank-a'])
      handle.selectMode('coop')
      send(pad(0), pad(1))
      assert.equal(
        state,
        'title',
        'connecting controllers or highlighting a mode must not start play',
      )
      assert.deepEqual(controllers?.bindings, [null, null])
      send(pad(0, [0]), pad(1))
      assert.deepEqual(controllers?.bindings, [0, 1])
      assert.equal(controllers?.canPlay, true)
      assert.equal(state, 'playing')
      handle.menuAction('right')
      assert.equal(campaignChanges.length, 1, 'cannot switch maps during battle')
      send(pad(0), pad(1))
      send(pad(1))
      assert.equal(state, 'paused')
      assert.deepEqual(controllers?.bindings, [null, 1])
      send(pad(0), pad(1))
      assert.equal(controllers?.canPlay, false)
      send(pad(0, [0]), pad(1))
      assert.deepEqual(controllers?.bindings, [0, 1])
      assert.equal(state, 'paused', 'joining does not automatically resume')
      send(pad(0), pad(1))
      send(pad(0, [0]), pad(1))
      assert.equal(state, 'playing')
      send(pad(0), pad(1))
      send(pad(0), pad(1, [9]))
      assert.equal(state, 'paused', 'either player can pause')
      send(pad(0), pad(1))
      // Navigate the pause menu with P1, toggle sound, and return to the title.
      send(pad(0, [13]), pad(1))
      send(pad(0), pad(1))
      send(pad(0, [0]), pad(1))
      assert.equal(menu?.soundEnabled, false)
      send(pad(0), pad(1))
      send(pad(0, [13]), pad(1))
      send(pad(0), pad(1))
      send(pad(0, [13]), pad(1))
      send(pad(0), pad(1))
      send(pad(0, [0]), pad(1))
      assert.equal(state, 'title')
      assert.equal(menu?.mode, 'coop')
      handle.selectMode('practice')
      handle.setPracticeStage(999)
      assert.equal(menu?.practiceStage, lastStage)
      handle.setPracticeStage(lastStage)
      assert.deepEqual(controllers?.bindings, [0, null])
      handle.confirm()
      frames()
      assert.equal(state, 'title')
      assert.equal(menu?.page, 'practice', 'practice opens a separate stage picker')
      handle.confirm()
      frames()
      assert.equal(state, 'playing')
      handle.togglePause()
      frames()
      handle.returnToTitle()
      assert.equal(menu?.practiceStage, lastStage)
      handle.selectMode('single')
      send()
      assert.equal(controllers?.canPlay, false)
      handle.useKeyboard()
      handle.confirm()
      frames()
      assert.equal(state, 'title')
      assert.equal(menu?.page, 'campaign')
      assert.equal(menu?.progress.single, initialProgress)
      handle.menuAction('down')
      assert.equal(menu?.startSelection, 1)
      handle.confirm()
      frames()
      assert.equal(state, 'playing')
      assert.equal(menu?.continued, false)
      assert.equal(
        menu?.progress.single,
        initialProgress,
        'starting over preserves the saved progress',
      )
      handle.togglePause()
      frames()
      handle.returnToTitle()
      handle.selectMode('coop')
      assert.equal(menu?.awaitingControllers, false)
      handle.confirm()
      frames()
      assert.equal(menu?.awaitingControllers, true)
      assert.equal(state, 'title')
      send(pad(0))
      assert.equal(state, 'title', 'one controller cannot launch coop')
      handle.menuAction('back')
      send(pad(0), pad(1))
      assert.equal(state, 'title', 'cancelling the prompt prevents late devices from starting play')
      assert.equal(menu?.awaitingControllers, false)
      handle.selectMode('coop')
      handle.confirm()
      frames()
      assert.equal(state, 'playing')
      handle.togglePause()
      frames()
      handle.returnToTitle()
      handle.selectMode('coop')
      send()
      handle.confirm()
      frames()
      send(pad(0))
      assert.equal(state, 'title')
      send(pad(0), pad(1, [0]))
      assert.equal(
        state,
        'playing',
        'a requested coop game starts when the missing controller becomes available',
      )
      handle.togglePause()
      frames()
      handle.returnToTitle()
      handle.selectMode('single')
      handle.useKeyboard()
      send(pad(0), pad(1))
      send(pad(0, [0]), pad(1))
      assert.equal(state, 'title', 'solo with progress offers continue or start over')
      assert.equal(menu?.page, 'campaign')
      send(pad(0), pad(1))
      send(pad(0, [0]), pad(1))
      assert.equal(state, 'playing')
      assert.equal(menu?.continued, true)
      assert.deepEqual(controllers?.bindings, [0, null])

      // Reload with a saved two-player run: continuation must still require both controllers.
      handle.destroy()
      pads = []
      saveProgress(8, undefined, storage, campaignId, 'coop')
      handle = mount()
      handle.selectMode('coop')
      handle.confirm()
      frames()
      assert.equal(state, 'title')
      assert.equal(menu?.page, 'campaign')
      assert.equal(menu?.progress.coop, 8)
      assert.equal(menu?.progress.single, initialProgress)
      handle.chooseStart(true)
      frames()
      assert.equal(menu?.awaitingControllers, true)
      send(pad(0))
      assert.equal(state, 'title', 'continuing coop still needs the second controller')
      send(pad(0), pad(1))
      assert.equal(state, 'playing')
      assert.equal(menu?.continued, true)
      assert.deepEqual(controllers?.bindings, [0, 1])
      assert.equal(loadProgress(undefined, storage, campaignId, 'coop'), 8)
      assert.equal(loadProgress(undefined, storage, campaignId, 'single'), initialProgress)
      handle.togglePause()
      frames()
      handle.returnToTitle()
      handle.confirm()
      handle.chooseStart(false)
      frames()
      assert.equal(state, 'playing')
      assert.equal(menu?.continued, false)
      assert.equal(menu?.progress.coop, 8, 'starting over keeps the two-player save')
      assert.equal(loadProgress(undefined, storage, campaignId, 'coop'), 8)
    } finally {
      handle.destroy()
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  })
}
