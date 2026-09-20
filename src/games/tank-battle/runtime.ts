import {
  browserGamepadPlatform,
  monitorGamepads,
  type MonitorSnapshot,
} from '@/features/gamepad/monitor.ts'
import { GamepadPlayers, type PlayerCount, type PlayerSlot } from '@/features/gamepad/players.ts'
import { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { GameLoop } from '@/games/tank-battle/core/GameLoop.ts'
import { InputManager } from '@/games/tank-battle/core/InputManager.ts'
import { PixelCanvas } from '@/games/tank-battle/render/PixelCanvas.ts'
import { SceneManager, type TankBattleResult } from '@/games/tank-battle/scene/SceneManager.ts'
import { SceneKind, type LevelData, type TankBattleHoldAction } from '@/games/tank-battle/types.ts'

export type TankBattleUiState = 'title' | 'playing' | 'paused' | 'gameOver'

export interface TankBattleHandle {
  destroy(): void
  setHeldAction(action: TankBattleHoldAction, active: boolean): void
  confirm(): void
  togglePause(): void
  returnToTitle(): void
  setSoundEnabled(enabled: boolean): void
  setPracticeStage(stage: number | null): void
  setPlayerCount(count: PlayerCount): void
  bindGamepad(slot: PlayerSlot, index: number | null): void
}

export interface TankBattleControllers {
  snapshot: MonitorSnapshot
  bindings: [number | null, number | null]
  canPlay: boolean
}

export interface TankBattleOptions {
  readonly customLevel?: LevelData
  readonly onControllersChange?: (state: TankBattleControllers) => void
  readonly initialHighScore?: number
  readonly onGameOver?: (result: TankBattleResult) => void
  readonly onStateChange?: (state: TankBattleUiState) => void
}

/**
 * 把坦克大战挂载到广场提供的画布中。
 *
 * 游戏内部仍保持独立的循环、输入、音频和场景实现；广场只负责提供挂载点，
 * 并在离开详情页时通过返回的 handle 释放所有浏览器资源。
 */
export function mountTankBattle(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  options: TankBattleOptions = {},
): TankBattleHandle {
  const pixelCanvas = new PixelCanvas(canvas, container)
  const audio = new AudioEngine()
  const input = new InputManager()
  const players = new GamepadPlayers()
  let playerCount: PlayerCount = 1
  let snapshot: MonitorSnapshot = { status: 'waiting', devices: [] }
  const required: [boolean, boolean] = [false, false]
  const canPlay = () =>
    (playerCount === 1
      ? !required[0] || players.getBinding(0) !== null
      : players.getBinding(0) !== null && players.getBinding(1) !== null) &&
    (!(required[0] || playerCount === 2) || snapshot.status === 'ready')
  let previousControllers = ''
  const notifyControllers = () => {
    const state: TankBattleControllers = {
      snapshot,
      bindings: [players.getBinding(0), players.getBinding(1)],
      canPlay: canPlay(),
    }
    // Button changes feed the game loop directly; React only needs connection changes.
    const key = JSON.stringify({
      status: snapshot.status,
      devices: snapshot.devices.map(({ index, id, mapping }) => ({ index, id, mapping })),
      bindings: state.bindings,
      canPlay: state.canPlay,
    })
    if (key !== previousControllers) {
      previousControllers = key
      options.onControllersChange?.(state)
    }
  }

  // 浏览器要求 AudioContext 在用户手势后才能启动
  input.onFirstInteraction((): void => {
    audio.unlock()
  })
  input.attach()

  // 种子取当前时间，使每局的敌方行为与道具掉落不同
  const sceneManager = new SceneManager(audio, Date.now() >>> 0, options)
  let lastUiState: TankBattleUiState | undefined
  const syncUiState = (): void => {
    const kind = sceneManager.getCurrentKind()
    const state: TankBattleUiState =
      kind === SceneKind.TITLE
        ? 'title'
        : kind === SceneKind.GAME_OVER
          ? 'gameOver'
          : sceneManager.isPaused()
            ? 'paused'
            : 'playing'
    if (state === lastUiState) return
    lastUiState = state
    options.onStateChange?.(state)
  }

  const loop = new GameLoop({
    update: (): void => {
      const keyboard = input.getSnapshot()
      const p1 = players.consume(0)
      const p2 = players.consume(1)
      if (canPlay())
        sceneManager.update({
          up: keyboard.up || p1.up,
          down: keyboard.down || p1.down,
          left: keyboard.left || p1.left,
          right: keyboard.right || p1.right,
          fire: keyboard.fire || p1.fire,
          confirmEdge: keyboard.confirmEdge || p1.confirmEdge || p2.confirmEdge,
          pauseEdge: keyboard.pauseEdge || p1.pauseEdge || p2.pauseEdge,
          player2: p2,
        })
      syncUiState()
    },
    render: (): void => {
      pixelCanvas.clear('#000000')
      sceneManager.render(pixelCanvas.context)
    },
  })

  const suspend = () => {
    audio.stopAll()
    input.clear()
    sceneManager.suspend()
    syncUiState()
  }
  const stopMonitoring = monitorGamepads(browserGamepadPlatform(), (next) => {
    const before = [players.getBinding(0), players.getBinding(1)]
    snapshot = next
    players.update(next)
    const lostBinding = before.some(
      (index, slot) => index !== null && players.getBinding(slot as PlayerSlot) === null,
    )
    if (lostBinding || next.status === 'paused' || next.status === 'error') suspend()
    notifyControllers()
  })
  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      suspend()
      loop.stop()
    } else {
      loop.resetClock()
      loop.start()
    }
  }
  window.addEventListener('blur', suspend)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 点击画布也算一次用户手势，用于解锁音频
  const handlePointerDown = (): void => {
    audio.unlock()
  }
  canvas.addEventListener('pointerdown', handlePointerDown)

  syncUiState()
  loop.start()

  let destroyed = false
  return {
    destroy(): void {
      if (destroyed) {
        return
      }
      destroyed = true

      loop.stop()
      stopMonitoring()
      window.removeEventListener('blur', suspend)
      input.detach()
      pixelCanvas.dispose()
      audio.dispose()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      canvas.removeEventListener('pointerdown', handlePointerDown)
    },
    setHeldAction(action: TankBattleHoldAction, active: boolean): void {
      input.setHeldAction(action, active)
    },
    confirm(): void {
      input.requestConfirm()
    },
    togglePause(): void {
      input.requestPause()
    },
    returnToTitle(): void {
      input.clear()
      players.consume(0)
      players.consume(1)
      sceneManager.returnToTitle()
      syncUiState()
    },
    setSoundEnabled(enabled: boolean): void {
      audio.unlock()
      audio.setEnabled(enabled)
    },
    setPracticeStage(stage: number | null): void {
      sceneManager.setPracticeStage(stage)
    },
    setPlayerCount(count): void {
      if (sceneManager.getCurrentKind() === SceneKind.BATTLE) return
      playerCount = count
      players.setPlayerCount(count)
      sceneManager.setPlayerCount(count)
      input.clear()
      players.consume(0)
      players.consume(1)
      notifyControllers()
    },
    bindGamepad(slot, index): void {
      if (players.bind(slot, index)) {
        required[slot] = index !== null
        suspend()
        notifyControllers()
      }
    },
  }
}
