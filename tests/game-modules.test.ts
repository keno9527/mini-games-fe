import test from 'node:test'
import assert from 'node:assert/strict'

import {
  gameCatalog,
  getCatalogGame,
} from '../src/features/games/data.ts'

test('tank battle is available as an internal plaza game', () => {
  const game = getCatalogGame('tank-battle')

  assert.ok(game)
  assert.equal(game.name, '坦克大战')
  assert.deepEqual(game.difficulties, ['经典战役'])
})

test('every internal catalog game is exposed through a lazy game module', async () => {
  type GameRegistry = {
    getGameComponent: (gameId: string) => { $$typeof?: symbol } | undefined
    getRegisteredGame: (gameId: string) => unknown
    getRegisteredGamePresentation: (gameId: string) => { icon: string } | undefined
  }

  let registry: GameRegistry | undefined
  try {
    registry = await import('../src/games/registry.ts') as GameRegistry
  } catch {
    // The assertion below reports the missing module as the contract failure.
  }

  assert.ok(registry, 'the game module registry must exist')
  assert.equal(typeof registry.getRegisteredGame, 'function')
  assert.equal(typeof registry.getRegisteredGamePresentation, 'function')

  const internalGames = gameCatalog.filter(game => !game.externalUrl)
  for (const game of internalGames) {
    assert.deepEqual(registry.getRegisteredGame(game.id), game)
    assert.ok(registry.getRegisteredGamePresentation(game.id)?.icon)

    const gameComponent = registry.getGameComponent(game.id)
    assert.ok(gameComponent, `${game.id} is missing a game module`)
    assert.equal(
      gameComponent.$$typeof,
      Symbol.for('react.lazy'),
      `${game.id} must be lazy loaded`,
    )
  }

  assert.equal('getGameLoader' in registry, false)
  assert.equal(registry.getRegisteredGame('unknown-game'), undefined)
  assert.equal(registry.getRegisteredGamePresentation('unknown-game'), undefined)
  assert.equal(registry.getGameComponent('unknown-game'), undefined)
})

test('tank battle high score is injected and kept inside the game session', async () => {
  const { World } = await import('../src/games/tank-battle/system/World.ts')
  const world = new World(42, 500)

  world.addScore(250)
  assert.equal(world.score, 250)
  assert.equal(world.highScore, 500)

  world.addScore(300)
  assert.equal(world.score, 550)
  assert.equal(world.highScore, 550)
})

test('tank battle runtime releases browser resources when unmounted', async () => {
  type Listener = (...args: unknown[]) => void
  const windowListeners = new Map<string, Set<Listener>>()
  const documentListeners = new Map<string, Set<Listener>>()
  const canvasListeners = new Map<string, Set<Listener>>()

  const addListener = (listeners: Map<string, Set<Listener>>) =>
    (type: string, listener: Listener) => {
      const entries = listeners.get(type) ?? new Set<Listener>()
      entries.add(listener)
      listeners.set(type, entries)
    }
  const removeListener = (listeners: Map<string, Set<Listener>>) =>
    (type: string, listener: Listener) => {
      listeners.get(type)?.delete(listener)
    }

  const fakeWindow = {
    innerWidth: 1280,
    innerHeight: 800,
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
    },
    addEventListener: addListener(windowListeners),
    removeEventListener: removeListener(windowListeners),
  }
  const fakeDocument = {
    hidden: false,
    addEventListener: addListener(documentListeners),
    removeEventListener: removeListener(documentListeners),
  }

  let animationFrameRequests = 0
  let cancelledAnimationFrames = 0
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: fakeWindow,
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument,
  })
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: () => {
      animationFrameRequests += 1
      return animationFrameRequests
    },
  })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: () => {
      cancelledAnimationFrames += 1
    },
  })

  const context = {
    fillStyle: '',
    fillRect: () => undefined,
    imageSmoothingEnabled: true,
  }
  const stage = { clientWidth: 760 }
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    parentElement: stage,
    getContext: () => context,
    addEventListener: addListener(canvasListeners),
    removeEventListener: removeListener(canvasListeners),
  }

  type RuntimeModule = {
    mountTankBattle: (
      canvasElement: unknown,
      containerElement: unknown,
    ) => { destroy: () => void }
  }
  let runtime: RuntimeModule | undefined
  try {
    runtime = await import('../src/games/tank-battle/runtime.ts') as RuntimeModule
  } catch {
    // The assertion below reports the missing runtime as the contract failure.
  }

  assert.ok(runtime, 'the embeddable tank battle runtime must exist')
  const handle = runtime.mountTankBattle(canvas, stage)

  assert.equal(animationFrameRequests, 1)
  assert.equal(windowListeners.get('keydown')?.size, 1)
  assert.equal(windowListeners.get('resize')?.size, 1)
  assert.equal(documentListeners.get('visibilitychange')?.size, 1)
  assert.equal(canvasListeners.get('pointerdown')?.size, 1)

  handle.destroy()
  handle.destroy()

  assert.equal(cancelledAnimationFrames, 1)
  assert.equal(windowListeners.get('keydown')?.size, 0)
  assert.equal(windowListeners.get('resize')?.size, 0)
  assert.equal(documentListeners.get('visibilitychange')?.size, 0)
  assert.equal(canvasListeners.get('pointerdown')?.size, 0)
})
