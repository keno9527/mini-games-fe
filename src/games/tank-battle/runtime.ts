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
}

export interface TankBattleOptions {
  readonly customLevel?: LevelData
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
      sceneManager.update(input.getSnapshot())
      syncUiState()
    },
    render: (): void => {
      pixelCanvas.clear('#000000')
      sceneManager.render(pixelCanvas.context)
    },
  })

  // 切后台时暂停循环：既省电，也避免恢复瞬间的时间差造成逻辑跳帧
  const handleVisibilityChange = (): void => {
    if (document.hidden) {
      input.releaseHeldActions()
      if (sceneManager.getCurrentKind() === SceneKind.BATTLE && !sceneManager.isPaused()) {
        input.requestPause()
        sceneManager.update(input.getSnapshot())
        syncUiState()
      }
      audio.stopAll()
      loop.stop()
    } else {
      loop.resetClock()
      loop.start()
    }
  }
  const handleBlur = (): void => {
    input.releaseHeldActions()
    if (sceneManager.getCurrentKind() === SceneKind.BATTLE && !sceneManager.isPaused()) {
      input.requestPause()
      sceneManager.update(input.getSnapshot())
      syncUiState()
    }
    audio.stopAll()
  }
  window.addEventListener('blur', handleBlur)
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
      input.detach()
      pixelCanvas.dispose()
      audio.dispose()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('blur', handleBlur)
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
      input.releaseHeldActions()
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
  }
}
