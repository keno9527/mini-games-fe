import type { DeviceReading, MonitorSnapshot } from './monitor.ts'

export type PlayerSlot = 0 | 1
export type PlayerCount = 1 | 2

export interface PlayerControls {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  fire: boolean
  confirmEdge: boolean
  pauseEdge: boolean
}

export const idleControls = (): PlayerControls => ({
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
  confirmEdge: false,
  pauseEdge: false,
})

interface Binding {
  index: number
  id: string
  armed: boolean
  confirm: boolean
  pause: boolean
}

/** Independent player slots. Reconnecting a device requires an explicit binding. */
export class GamepadPlayers {
  private bindings: [Binding | null, Binding | null] = [null, null]
  private controls: [PlayerControls, PlayerControls] = [idleControls(), idleControls()]
  private snapshot: MonitorSnapshot = { status: 'waiting', devices: [] }
  private count: PlayerCount = 1

  setPlayerCount(count: PlayerCount): void {
    this.count = count
    if (count === 1) this.bind(1, null)
  }

  getBinding(slot: PlayerSlot): number | null {
    return this.bindings[slot]?.index ?? null
  }

  bind(slot: PlayerSlot, index: number | null): boolean {
    if (index === null) {
      this.bindings[slot] = null
      this.controls[slot] = idleControls()
      return true
    }
    const device = this.snapshot.devices.find((pad) => pad.index === index)
    if (
      slot >= this.count ||
      !device ||
      device.mapping !== 'standard' ||
      this.bindings.some((binding, other) => other !== slot && binding?.index === index)
    )
      return false
    this.bindings[slot] = { index, id: device.id, armed: false, confirm: false, pause: false }
    this.controls[slot] = idleControls()
    this.update(this.snapshot)
    return true
  }

  update(snapshot: MonitorSnapshot): void {
    this.snapshot = snapshot
    for (const slot of [0, 1] as const) {
      const binding = this.bindings[slot]
      if (!binding) continue
      if (snapshot.status === 'paused' || snapshot.status === 'error') {
        binding.armed = false
        binding.confirm = false
        binding.pause = false
        this.controls[slot] = idleControls()
        continue
      }
      const device = snapshot.devices.find(
        (pad) => pad.index === binding.index && pad.id === binding.id,
      )
      if (!device || device.mapping !== 'standard') {
        this.bind(slot, null)
        continue
      }
      const next = readControls(device)
      const confirm = pressed(device, 0)
      const pause = pressed(device, 9)
      // Release controls after binding/focus recovery before allowing gameplay input.
      if (!binding.armed) {
        binding.armed = !Object.values(next).some(Boolean) && !confirm && !pause
        this.controls[slot] = idleControls()
        continue
      }
      next.confirmEdge = this.controls[slot].confirmEdge || (confirm && !binding.confirm)
      next.pauseEdge = this.controls[slot].pauseEdge || (pause && !binding.pause)
      binding.confirm = confirm
      binding.pause = pause
      this.controls[slot] = next
    }
  }

  /** Consume one-shot actions while retaining held directions and fire. */
  consume(slot: PlayerSlot): PlayerControls {
    const result = { ...this.controls[slot] }
    this.controls[slot].confirmEdge = false
    this.controls[slot].pauseEdge = false
    return result
  }
}

const pressed = (device: DeviceReading, index: number) => device.buttons[index]?.pressed ?? false

function readControls(device: DeviceReading): PlayerControls {
  const x = device.axes[0] ?? 0
  const y = device.axes[1] ?? 0
  return {
    ...idleControls(),
    up: pressed(device, 12) || y < -0.25,
    down: pressed(device, 13) || y > 0.25,
    left: pressed(device, 14) || x < -0.25,
    right: pressed(device, 15) || x > 0.25,
    fire: pressed(device, 0) || pressed(device, 7),
  }
}
