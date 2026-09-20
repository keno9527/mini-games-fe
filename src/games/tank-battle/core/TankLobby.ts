import { GamepadPlayers, type PlayerSlot } from '@/features/gamepad/players.ts'
import type { MonitorSnapshot } from '@/features/gamepad/monitor.ts'

export type TankMode = 'single' | 'coop' | 'practice'
export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back'
export interface PadMenuAction {
  index: number
  action: MenuAction
}
const actions: MenuAction[] = ['up', 'down', 'left', 'right', 'confirm', 'back']

/** Session ownership survives pauses; a missing slot is filled only by an explicit join press. */
export class TankLobby {
  readonly players = new GamepadPlayers()
  mode: TankMode = 'single'
  snapshot: MonitorSnapshot = { status: 'waiting', devices: [] }
  private required = false
  private previous = new Map<string, Set<MenuAction>>()
  private recovering = false
  private owners: [{ index: number; id: string } | null, { index: number; id: string } | null] = [
    null,
    null,
  ]

  get count(): 1 | 2 {
    return this.mode === 'coop' ? 2 : 1
  }
  get canPlay(): boolean {
    const needsPads = this.required || this.count === 2
    return (
      (!needsPads || this.snapshot.status === 'ready') &&
      (!needsPads || this.players.getBinding(0) !== null) &&
      (this.count === 1 || this.players.getBinding(1) !== null)
    )
  }

  select(mode: TankMode): void {
    this.mode = mode
    this.players.setPlayerCount(this.count)
    if (this.count === 1) this.owners[1] = null
  }

  join(index: number): boolean {
    if ([0, 1].some((slot) => this.players.getBinding(slot as PlayerSlot) === index)) return false
    const device = this.snapshot.devices.find((pad) => pad.index === index)
    if (!device) return false
    const slots: PlayerSlot[] = this.count === 2 ? [0, 1] : [0]
    const sameId = slots.filter(
      (slot) => this.owners[slot]?.id === device.id && this.players.getBinding(slot) === null,
    )
    const remembered =
      sameId.find((slot) => this.owners[slot]?.index === index) ??
      (sameId.length === 1 ? sameId[0] : undefined)
    const slot = remembered ?? slots.find((slot) => this.players.getBinding(slot) === null)
    if (
      slot === undefined ||
      this.players.getBinding(slot) !== null ||
      !this.players.bind(slot, index)
    )
      return false
    this.owners[slot] = { index, id: device.id }
    if (slot === 0) this.required = true
    return true
  }

  useKeyboard(): void {
    if (this.count !== 1) return
    this.players.bind(0, null)
    this.owners[0] = null
    this.required = false
  }

  reassign(): void {
    this.players.bind(0, null)
    this.players.bind(1, null)
    this.owners = [null, null]
    this.required = true
  }

  update(snapshot: MonitorSnapshot): { lostBinding: boolean; actions: PadMenuAction[] } {
    const before = [this.players.getBinding(0), this.players.getBinding(1)]
    this.snapshot = snapshot
    this.players.update(snapshot)
    const lostBinding = before.some(
      (index, slot) => index !== null && this.players.getBinding(slot as PlayerSlot) === null,
    )
    const events: PadMenuAction[] = []
    if (snapshot.status !== 'ready') {
      this.previous.clear()
      this.recovering = snapshot.status === 'paused' || snapshot.status === 'error'
      return { lostBinding, actions: events }
    }
    const next = new Map<string, Set<MenuAction>>()
    for (const device of snapshot.devices) {
      if (device.mapping !== 'standard') continue
      const pressed = (i: number) => device.buttons[i]?.pressed ?? false
      const held = new Set<MenuAction>()
      if (pressed(12) || (device.axes[1] ?? 0) < -0.5) held.add('up')
      if (pressed(13) || (device.axes[1] ?? 0) > 0.5) held.add('down')
      if (pressed(14) || (device.axes[0] ?? 0) < -0.5) held.add('left')
      if (pressed(15) || (device.axes[0] ?? 0) > 0.5) held.add('right')
      if (pressed(0)) held.add('confirm')
      if (pressed(1)) held.add('back')
      const key = `${device.index}:${device.id}`
      const previous = this.previous.get(key)
      // Following focus recovery each existing hold must be released first.
      for (const action of actions) {
        if (held.has(action) && !previous?.has(action) && !this.recovering)
          events.push({ index: device.index, action })
      }
      next.set(key, held)
    }
    this.recovering = false
    this.previous = next
    return { lostBinding, actions: events }
  }
}
