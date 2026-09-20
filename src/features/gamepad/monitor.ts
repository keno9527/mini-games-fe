export interface ButtonReading {
  pressed: boolean
  touched: boolean
  value: number
}

export interface DeviceReading {
  id: string
  index: number
  mapping: string
  buttons: ButtonReading[]
  axes: number[]
}

export type MonitorStatus = 'waiting' | 'ready' | 'paused' | 'unsupported' | 'insecure' | 'error'
export interface MonitorSnapshot {
  status: MonitorStatus
  devices: DeviceReading[]
}

export const STANDARD_BUTTON_NAMES = [
  '下方主键 · A / ×',
  '右侧主键 · B / ○',
  '左侧主键 · X / □',
  '上方主键 · Y / △',
  '左肩键 · LB / L1',
  '右肩键 · RB / R1',
  '左扳机 · LT / L2',
  '右扳机 · RT / R2',
  '返回 / View',
  '开始 / Menu',
  '左摇杆按下',
  '右摇杆按下',
  '方向键 ↑',
  '方向键 ↓',
  '方向键 ←',
  '方向键 →',
  '主菜单',
] as const

const rounded = (value: number, min: number, max: number): number =>
  Number(Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0)).toFixed(3))

/** Copy live browser objects so prior readings remain stable; preserve every raw control. */
export function readDevices(pads: ArrayLike<Gamepad | null>): DeviceReading[] {
  return Array.from(pads).flatMap((pad) =>
    pad?.connected
      ? [
          {
            id: pad.id,
            index: pad.index,
            mapping: pad.mapping,
            buttons: Array.from(pad.buttons, (button) => ({
              pressed: button.pressed,
              touched: button.touched,
              value: rounded(button.value, 0, 1),
            })),
            axes: Array.from(pad.axes, (axis) => rounded(axis, -1, 1)),
          },
        ]
      : [],
  )
}

export interface GamepadPlatform {
  secure: boolean
  supported: boolean
  active(): boolean
  read(): ArrayLike<Gamepad | null>
  subscribe(listener: () => void): () => void
  requestFrame(callback: (time: number) => void): number
  cancelFrame(id: number): void
}

export function browserGamepadPlatform(): GamepadPlatform {
  return {
    secure: window.isSecureContext,
    supported: typeof navigator.getGamepads === 'function',
    active: () => !document.hidden && document.hasFocus(),
    read: () => navigator.getGamepads(),
    subscribe(listener) {
      const events = ['gamepadconnected', 'gamepaddisconnected', 'focus', 'blur'] as const
      events.forEach((event) => window.addEventListener(event, listener))
      document.addEventListener('visibilitychange', listener)
      return () => {
        events.forEach((event) => window.removeEventListener(event, listener))
        document.removeEventListener('visibilitychange', listener)
      }
    },
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
  }
}

/** Read each animation frame but publish only changed readings. No polling survives disposal. */
export function monitorGamepads(
  platform: GamepadPlatform,
  onChange: (snapshot: MonitorSnapshot) => void,
): () => void {
  let previous = ''
  let disposed = false
  let frame = 0
  const publish = (snapshot: MonitorSnapshot) => {
    const serialized = JSON.stringify(snapshot)
    if (!disposed && serialized !== previous) {
      previous = serialized
      onChange(snapshot)
    }
  }
  const poll = () => {
    if (disposed) return
    if (!platform.active()) {
      publish({ status: 'paused', devices: [] })
      return
    }
    try {
      const devices = readDevices(platform.read())
      publish({ status: devices.length ? 'ready' : 'waiting', devices })
    } catch {
      publish({ status: 'error', devices: [] })
    }
  }
  if (!platform.secure || !platform.supported) {
    publish({ status: !platform.secure ? 'insecure' : 'unsupported', devices: [] })
    return () => {
      disposed = true
    }
  }
  const unsubscribe = platform.subscribe(poll)
  const tick = () => {
    if (disposed) return
    poll()
    frame = platform.requestFrame(tick)
  }
  poll()
  frame = platform.requestFrame(tick)
  return () => {
    if (disposed) return
    disposed = true
    platform.cancelFrame(frame)
    unsubscribe()
  }
}
