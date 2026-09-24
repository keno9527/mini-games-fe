import {
  browserGamepadPlatform,
  monitorGamepads,
  type MonitorSnapshot,
} from '@/features/gamepad/monitor.ts'
import { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { GameLoop } from '@/games/tank-battle/core/GameLoop.ts'
import { InputManager } from '@/games/tank-battle/core/InputManager.ts'
import {
  TankLobby,
  type TankMode,
  type MenuAction,
  type PadMenuAction,
} from '@/games/tank-battle/core/TankLobby.ts'
import { isValidStage, type CampaignMode, type CampaignProgress } from './progress.ts'
import { CAMPAIGNS, type CampaignId } from '@/games/tank-battle/data/campaigns.ts'
import { PixelCanvas } from '@/games/tank-battle/render/PixelCanvas.ts'
import { SceneManager, type TankBattleResult } from '@/games/tank-battle/scene/SceneManager.ts'
import { SceneKind, type LevelData, type TankBattleHoldAction } from '@/games/tank-battle/types.ts'

export type TankBattleUiState = 'title' | 'playing' | 'paused' | 'gameOver'
export interface TankBattleMenu {
  mode: TankMode
  page: 'modes' | 'practice' | 'campaign'
  progress: CampaignProgress
  retryStage: number | null
  startSelection: number
  continued: boolean
  awaitingControllers: boolean
  practiceStage: number
  pauseSelection: number
  soundEnabled: boolean
}
export interface TankBattleHandle {
  destroy(): void
  setViewport(viewport: HTMLElement | null): void
  suspend(): void
  setHeldAction(action: TankBattleHoldAction, active: boolean): void
  confirm(): void
  togglePause(): void
  returnToTitle(): void
  setSoundEnabled(enabled: boolean): void
  setPracticeStage(stage: number): void
  selectMode(mode: TankMode): void
  chooseStart(continueProgress: boolean): void
  menuAction(action: MenuAction): void
  useKeyboard(): void
  reassignGamepads(): void
}
export interface TankBattleControllers {
  snapshot: MonitorSnapshot
  bindings: [number | null, number | null]
  canPlay: boolean
}
export interface TankBattleOptions {
  readonly campaignId?: CampaignId
  readonly onCampaignChange?: (campaignId: CampaignId) => void
  readonly initialProgress?: Partial<CampaignProgress>
  readonly onStageReached?: (stage: number, mode: CampaignMode) => void
  readonly customLevel?: LevelData
  readonly onControllersChange?: (state: TankBattleControllers) => void
  readonly onMenuChange?: (state: TankBattleMenu) => void
  readonly initialHighScore?: number
  readonly onGameOver?: (result: TankBattleResult) => void
  readonly onStateChange?: (state: TankBattleUiState) => void
}

export function mountTankBattle(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  options: TankBattleOptions = {},
): TankBattleHandle {
  const campaignId = options.campaignId ?? 'battle-city'
  const levels = CAMPAIGNS[campaignId].levels
  const pixelCanvas = new PixelCanvas(canvas, container)
  const audio = new AudioEngine()
  const input = new InputManager()
  const lobby = new TankLobby()
  const players = lobby.players
  const menu: TankBattleMenu = {
    mode: 'single',
    page: 'modes',
    progress: {
      single: isValidStage(options.initialProgress?.single, campaignId)
        ? options.initialProgress.single
        : 0,
      coop: isValidStage(options.initialProgress?.coop, campaignId)
        ? options.initialProgress.coop
        : 0,
    },
    retryStage: null,
    startSelection: 0,
    continued: false,
    awaitingControllers: false,
    practiceStage: 0,
    pauseSelection: 0,
    soundEnabled: true,
  }
  const sceneManager = new SceneManager(audio, Date.now() >>> 0, {
    ...options,
    onStageReached: (stage, mode) => {
      menu.progress = { ...menu.progress, [mode]: Math.max(menu.progress[mode], stage) }
      options.onStageReached?.(menu.progress[mode], mode)
      notifyMenu()
    },
  })
  let previousControllers = ''
  let lastUiState: TankBattleUiState | undefined
  let pending: PadMenuAction[] = []
  let startPending = false
  const isTitle = () => sceneManager.getCurrentKind() === SceneKind.TITLE
  const notifyMenu = () => options.onMenuChange?.({ ...menu })
  const notifyControllers = () => {
    const state: TankBattleControllers = {
      snapshot: lobby.snapshot,
      bindings: [players.getBinding(0), players.getBinding(1)],
      canPlay: lobby.canPlay,
    }
    const key = JSON.stringify({
      ...state,
      snapshot: {
        status: state.snapshot.status,
        devices: state.snapshot.devices.map(({ index, id, mapping }) => ({ index, id, mapping })),
      },
    })
    if (key !== previousControllers) {
      previousControllers = key
      options.onControllersChange?.(state)
    }
  }
  const syncUiState = () => {
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
    if (state === 'paused') {
      menu.pauseSelection = 0
      notifyMenu()
    }
    menu.continued = sceneManager.isContinued()
    menu.retryStage = state === 'gameOver' ? sceneManager.getRetryStage() : null
    if (state === 'gameOver') menu.startSelection = 0
    notifyMenu()
    lastUiState = state
    options.onStateChange?.(state)
  }
  const selectMode = (mode: TankMode) => {
    if (!isTitle()) return
    lobby.select(mode)
    menu.mode = mode
    menu.page = 'modes'
    menu.startSelection = 0
    menu.awaitingControllers = false
    startPending = false
    sceneManager.setStartStage(null)
    sceneManager.setPlayerCount(lobby.count)
    sceneManager.setPracticeStage(mode === 'practice' ? menu.practiceStage : null)
    notifyMenu()
    notifyControllers()
  }
  const setPracticeStage = (stage: number) => {
    if (!isTitle()) return
    menu.practiceStage = Math.max(0, Math.min(levels.length - 1, Math.floor(stage)))
    sceneManager.setPracticeStage(menu.mode === 'practice' ? menu.practiceStage : null)
    notifyMenu()
  }
  const setSoundEnabled = (enabled: boolean) => {
    audio.unlock()
    audio.setEnabled(enabled)
    menu.soundEnabled = enabled
    notifyMenu()
  }
  const returnToTitle = () => {
    input.clear()
    pending = []
    players.consume(0)
    players.consume(1)
    sceneManager.returnToTitle()
    menu.page = 'modes'
    menu.awaitingControllers = false
    startPending = false
    notifyMenu()
    syncUiState()
  }
  const reassignGamepads = () => {
    if (!sceneManager.isPaused()) return
    lobby.reassign()
    pending = []
    notifyControllers()
  }
  // Starting a mode is the consent to assign available controllers. Merely connecting one
  // or highlighting a mode never starts a session.
  const requestStart = () => {
    if (lobby.snapshot.status === 'ready') {
      for (const device of lobby.snapshot.devices) lobby.join(device.index)
    }
    if (lobby.count === 1 && players.getBinding(0) === null) lobby.useKeyboard()
    menu.awaitingControllers = !lobby.canPlay
    startPending = lobby.canPlay
    notifyControllers()
    notifyMenu()
  }
  const selectStart = (selection: number) => {
    menu.startSelection = selection
    const highestStage = menu.mode === 'practice' ? null : menu.progress[menu.mode]
    sceneManager.setStartStage(
      selection === 0 ? (isTitle() ? highestStage : menu.retryStage) : null,
    )
    notifyMenu()
  }
  const chooseStart = (continueProgress: boolean) => {
    if (isTitle() && menu.page === 'campaign') {
      selectStart(continueProgress ? 0 : 1)
      requestStart()
    } else if (sceneManager.getCurrentKind() === SceneKind.GAME_OVER && menu.retryStage !== null) {
      selectStart(continueProgress ? 0 : 1)
      if (lobby.canPlay) input.requestConfirm()
    }
  }
  const dispatch = (action: MenuAction) => {
    if (isTitle()) {
      if (action === 'back') {
        menu.awaitingControllers = false
        startPending = false
        if (menu.page !== 'modes') {
          sceneManager.setStartStage(null)
          menu.page = 'modes'
          notifyMenu()
        } else selectMode('single')
      } else if (menu.page === 'campaign') {
        if (['up', 'down', 'left', 'right'].includes(action)) selectStart(1 - menu.startSelection)
        else if (action === 'confirm') chooseStart(menu.startSelection === 0)
      } else if (menu.page === 'practice') {
        if (action === 'left' || action === 'right')
          setPracticeStage(menu.practiceStage + (action === 'left' ? -1 : 1))
        else if (action === 'confirm') requestStart()
      } else if (
        (action === 'left' || action === 'right') &&
        !options.customLevel &&
        !menu.awaitingControllers
      ) {
        options.onCampaignChange?.(campaignId === 'battle-city' ? 'tank-a' : 'battle-city')
      } else if (action === 'up' || action === 'down') {
        const modes: TankMode[] = ['single', 'coop', 'practice']
        selectMode(modes[(modes.indexOf(menu.mode) + (action === 'up' ? 2 : 1)) % modes.length])
      } else if (action === 'confirm') {
        if (menu.mode === 'practice') {
          menu.page = 'practice'
          notifyMenu()
        } else if (!options.customLevel && menu.progress[menu.mode] > 0) {
          menu.page = 'campaign'
          selectStart(0)
        } else requestStart()
      }
    } else if (sceneManager.isPaused()) {
      if (action === 'up' || action === 'down') {
        menu.pauseSelection = (menu.pauseSelection + (action === 'up' ? 3 : 1)) % 4
        notifyMenu()
      } else if (action === 'back' && lobby.canPlay) input.requestPause()
      else if (action === 'confirm') {
        if (menu.pauseSelection === 0 && lobby.canPlay) input.requestPause()
        if (menu.pauseSelection === 1) setSoundEnabled(!menu.soundEnabled)
        if (menu.pauseSelection === 2) reassignGamepads()
        if (menu.pauseSelection === 3) returnToTitle()
      }
    } else if (sceneManager.getCurrentKind() === SceneKind.GAME_OVER) {
      if (action === 'back') returnToTitle()
      else if (menu.retryStage !== null && ['up', 'down', 'left', 'right'].includes(action))
        selectStart(1 - menu.startSelection)
      else if (action === 'confirm' && lobby.canPlay) input.requestConfirm()
    }
  }
  input.onFirstInteraction(() => audio.unlock())
  input.attach()
  const loop = new GameLoop({
    update: () => {
      const keyboard = input.getSnapshot()
      const p1 = players.consume(0)
      const p2 = players.consume(1)
      const menuOpen =
        isTitle() ||
        sceneManager.isPaused() ||
        sceneManager.getCurrentKind() === SceneKind.GAME_OVER
      let confirm = keyboard.confirmEdge
      let pause = keyboard.pauseEdge || p1.pauseEdge || p2.pauseEdge
      if (menuOpen) {
        // Menu confirmation and gameplay confirmation have separate queues.
        if ((isTitle() || sceneManager.isPaused()) && confirm) {
          confirm = false
          dispatch('confirm')
        }
        for (const event of pending) {
          const boundP1 = players.getBinding(0) === event.index
          const boundP2 = players.getBinding(1) === event.index
          if (!boundP1 && !boundP2) {
            if (
              event.action === 'confirm' ||
              (isTitle() &&
                players.getBinding(0) === null &&
                ['up', 'down', 'left', 'right'].includes(event.action))
            ) {
              const joined = lobby.join(event.index)
              if (joined && isTitle() && players.getBinding(0) === event.index)
                dispatch(event.action)
              notifyControllers()
            }
          } else if (boundP1) dispatch(event.action)
        }
        if (isTitle() && pause) {
          dispatch('back')
          pause = false
        }
        if (sceneManager.getCurrentKind() === SceneKind.GAME_OVER && pause) {
          returnToTitle()
          pause = false
          confirm = false
        }
      }
      pending = []
      confirm ||= startPending
      startPending = false
      if (lobby.canPlay)
        sceneManager.update({
          up: keyboard.up || p1.up,
          down: keyboard.down || p1.down,
          left: keyboard.left || p1.left,
          right: keyboard.right || p1.right,
          fire: keyboard.fire || p1.fire,
          confirmEdge: confirm,
          pauseEdge: pause,
          player2: p2,
        })
      syncUiState()
    },
    render: () => {
      pixelCanvas.clear('#000000')
      sceneManager.render(pixelCanvas.context)
    },
  })
  const suspend = () => {
    audio.stopAll()
    input.clear()
    pending = []
    startPending = false
    if (menu.awaitingControllers) {
      menu.awaitingControllers = false
      notifyMenu()
    }
    sceneManager.suspend()
    syncUiState()
  }
  const stopMonitoring = monitorGamepads(browserGamepadPlatform(), (next) => {
    const update = lobby.update(next)
    if (update.lostBinding || next.status === 'paused' || next.status === 'error') suspend()
    pending.push(...update.actions)
    if (isTitle() && menu.awaitingControllers && next.status === 'ready') requestStart()
    notifyControllers()
  })
  const handleVisibilityChange = () => {
    if (document.hidden) {
      suspend()
      loop.stop()
    } else {
      loop.resetClock()
      loop.start()
    }
  }
  // Capture short keyboard taps even when the title has not received pointer focus yet.
  const handleMenuKeyDown = (event: KeyboardEvent) => {
    if (
      !isTitle() &&
      !sceneManager.isPaused() &&
      sceneManager.getCurrentKind() !== SceneKind.GAME_OVER
    )
      return
    if (
      event.target instanceof HTMLElement &&
      event.target.closest('input, textarea, select, button, a, [contenteditable="true"]')
    )
      return
    const direction = (
      {
        ArrowUp: 'up',
        KeyW: 'up',
        ArrowDown: 'down',
        KeyS: 'down',
        ArrowLeft: 'left',
        KeyA: 'left',
        ArrowRight: 'right',
        KeyD: 'right',
      } as const
    )[event.code as 'ArrowUp']
    if (!direction) return
    event.preventDefault()
    if (!event.repeat) dispatch(direction)
  }
  window.addEventListener('keydown', handleMenuKeyDown)
  const handlePointerDown = () => audio.unlock()
  window.addEventListener('blur', suspend)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  canvas.addEventListener('pointerdown', handlePointerDown)
  notifyMenu()
  notifyControllers()
  syncUiState()
  loop.start()
  let destroyed = false
  return {
    setViewport: (viewport) => pixelCanvas.setViewport(viewport),
    suspend,
    destroy(): void {
      if (destroyed) {
        return
      }
      destroyed = true
      loop.stop()
      stopMonitoring()
      input.detach()
      pixelCanvas.dispose()
      audio.dispose()
      window.removeEventListener('blur', suspend)
      window.removeEventListener('keydown', handleMenuKeyDown)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      canvas.removeEventListener('pointerdown', handlePointerDown)
    },
    setHeldAction: (action, active) => input.setHeldAction(action, active),
    confirm: () => dispatch('confirm'),
    togglePause: () => {
      if (lobby.canPlay) input.requestPause()
    },
    returnToTitle,
    setSoundEnabled,
    setPracticeStage,
    selectMode,
    chooseStart,
    menuAction: dispatch,
    useKeyboard: () => {
      if (!isTitle() && !sceneManager.isPaused()) return
      lobby.useKeyboard()
      notifyControllers()
    },
    reassignGamepads,
  }
}
