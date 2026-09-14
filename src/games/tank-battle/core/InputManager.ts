import type { InputSnapshot, TankBattleHoldAction } from '@/games/tank-battle/types.ts'

const KEY_UP = new Set(['ArrowUp', 'KeyW'])
const KEY_DOWN = new Set(['ArrowDown', 'KeyS'])
const KEY_LEFT = new Set(['ArrowLeft', 'KeyA'])
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD'])
const KEY_FIRE = new Set(['Space', 'KeyJ'])
const KEY_PAUSE = new Set(['KeyP', 'Escape'])
const KEY_CONFIRM = new Set(['Enter', 'Space', 'KeyJ'])

/** 需要阻止默认行为的按键，避免方向键滚动页面、空格翻页 */
const PREVENT_DEFAULT_CODES = new Set([
  ...KEY_UP,
  ...KEY_DOWN,
  ...KEY_LEFT,
  ...KEY_RIGHT,
  ...KEY_FIRE,
])

/**
 * 键盘输入管理器：把原始键盘事件归一为抽象动作快照。
 *
 * 暂停与确认为「边沿触发」——只在按下的那一帧为 true，避免长按连续触发。
 * 通过 getSnapshot() 一次性取出不可变快照，保证同一 tick 内输入一致。
 */
export class InputManager {
  private readonly pressed = new Set<string>()
  private readonly heldActions = new Set<TankBattleHoldAction>()
  private pausePending = false
  private confirmPending = false
  private firstInteractionHandler: (() => void) | null = null

  attach(target: Window = window): void {
    target.addEventListener('keydown', this.onKeyDown)
    target.addEventListener('keyup', this.onKeyUp)
    // 失焦时清空按键，否则切走时按住的方向键会一直生效
    target.addEventListener('blur', this.onBlur)
  }

  detach(target: Window = window): void {
    target.removeEventListener('keydown', this.onKeyDown)
    target.removeEventListener('keyup', this.onKeyUp)
    target.removeEventListener('blur', this.onBlur)
  }

  /** 注册首次用户交互回调，用于满足浏览器对 AudioContext 的手势要求 */
  onFirstInteraction(handler: () => void): void {
    this.firstInteractionHandler = handler
  }

  getSnapshot(): InputSnapshot {
    const snapshot: InputSnapshot = {
      up: this.heldActions.has('up') || this.isAnyPressed(KEY_UP),
      down: this.heldActions.has('down') || this.isAnyPressed(KEY_DOWN),
      left: this.heldActions.has('left') || this.isAnyPressed(KEY_LEFT),
      right: this.heldActions.has('right') || this.isAnyPressed(KEY_RIGHT),
      fire: this.heldActions.has('fire') || this.isAnyPressed(KEY_FIRE),
      pauseEdge: this.pausePending,
      confirmEdge: this.confirmPending,
    }
    this.pausePending = false
    this.confirmPending = false
    return snapshot
  }

  /** 触控按钮与键盘共用同一份持续输入快照。 */
  setHeldAction(action: TankBattleHoldAction, active: boolean): void {
    this.notifyFirstInteraction()
    if (active) this.heldActions.add(action)
    else this.heldActions.delete(action)
  }

  requestPause(): void {
    this.notifyFirstInteraction()
    this.pausePending = true
  }

  requestConfirm(): void {
    this.notifyFirstInteraction()
    this.confirmPending = true
  }

  releaseHeldActions(): void {
    this.heldActions.clear()
  }

  private isAnyPressed(codes: ReadonlySet<string>): boolean {
    for (const code of codes) {
      if (this.pressed.has(code)) {
        return true
      }
    }
    return false
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (PREVENT_DEFAULT_CODES.has(event.code)) {
      event.preventDefault()
    }

    this.notifyFirstInteraction()

    // repeat 事件不触发边沿动作，但仍要保持按下态
    if (!event.repeat) {
      if (KEY_PAUSE.has(event.code)) {
        this.pausePending = true
      }
      if (KEY_CONFIRM.has(event.code)) {
        this.confirmPending = true
      }
    }

    this.pressed.add(event.code)
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code)
  }

  private readonly onBlur = (): void => {
    this.pressed.clear()
    this.releaseHeldActions()
  }

  private notifyFirstInteraction(): void {
    if (this.firstInteractionHandler === null) return
    const handler = this.firstInteractionHandler
    this.firstInteractionHandler = null
    handler()
  }
}
