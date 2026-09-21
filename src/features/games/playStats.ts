export interface PlayTotals {
  playCount: number
  totalDuration: number
}

export type PlayState = 'idle' | 'playing' | 'paused'

/** Only gameplay actions create rounds; visibility changes never create one. */
export class GamePlayTracker {
  private started = false
  private state: PlayState = 'idle'
  private visible = true
  private lastTick: number | null = null

  constructor(
    private readonly save: (delta: PlayTotals) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  flush = () => {
    const now = this.now()
    if (this.lastTick !== null) {
      const duration = Math.max(0, now - this.lastTick) / 1000
      if (duration > 0) this.save({ playCount: 0, totalDuration: duration })
      this.lastTick = now
    }
  }

  setState = (state: PlayState) => {
    this.flush()
    this.state = state
    if (state === 'idle') this.started = false
    if (state === 'playing' && !this.started) {
      this.started = true
      this.save({ playCount: 1, totalDuration: 0 })
    }
    this.lastTick = this.started && state === 'playing' && this.visible ? this.now() : null
  }

  start = () => this.setState('playing')
  stop = () => this.setState('idle')

  restart = () => {
    this.stop()
    this.start()
  }

  setVisible = (visible: boolean) => {
    this.flush()
    this.visible = visible
    this.lastTick = this.started && this.state === 'playing' && visible ? this.now() : null
  }
}

export function comparePlayTotals(a: PlayTotals, b: PlayTotals): number {
  return b.playCount - a.playCount || b.totalDuration - a.totalDuration
}
