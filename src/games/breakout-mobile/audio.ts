import { BreakoutAudio, type AudioSettings, type BreakoutSound } from '../breakout/audio'

/** Owns the mobile context without changing the desktop player's audio lifecycle. */
export class MobileAudio {
  private context: AudioContext | null = null
  private player: BreakoutAudio
  private retry = false
  private disposed = false
  private generation = 0
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private settings: AudioSettings,
    private report: (message: string) => void,
  ) {
    this.player = this.createPlayer()
  }

  private createPlayer() {
    return new BreakoutAudio(this.settings, () => {
      const Context = window.AudioContext ?? window.webkitAudioContext
      this.context = new Context()
      return this.context
    })
  }

  unlock() {
    if (this.disposed || !this.settings.enabled || this.settings.volume === 0) return
    if (this.retry || this.context?.state === 'closed') {
      this.player.dispose()
      this.context = null
      this.player = this.createPlayer()
      this.retry = false
    }
    const generation = ++this.generation
    clearTimeout(this.timer)
    this.player.unlock()
    const context = this.context
    const check = () => {
      if (generation !== this.generation || this.disposed) return
      this.retry = !context || context.state !== 'running'
      this.report(this.retry ? '音效尚未恢复，可点此重新开启' : '')
    }
    // Some iOS interruptions are neither suspended nor running.
    try {
      if (context && context.state !== 'running') void context.resume().then(check, check)
    } catch {
      check()
    }
    this.timer = setTimeout(check, 1000)
  }

  play = (sound: BreakoutSound) => this.player.play(sound)
  stopAll = () => this.player.stopAll()

  suspend() {
    this.generation++
    clearTimeout(this.timer)
    this.stopAll()
    try {
      void this.context?.suspend().catch(() => {})
    } catch {
      /* Context may have closed. */
    }
  }

  setSettings(settings: AudioSettings) {
    this.settings = settings
    this.player.setSettings(settings)
    this.generation++
    clearTimeout(this.timer)
    this.report('')
    this.unlock()
  }

  dispose() {
    this.disposed = true
    this.generation++
    clearTimeout(this.timer)
    this.player.dispose()
    this.context = null
  }
}
