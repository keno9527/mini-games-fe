// Original PCM sketches approved for Breakout; filenames match public/audio/breakout.
export const BREAKOUT_SOUNDS = [
  'launch',
  'paddle',
  'wall',
  'brick',
  'armor',
  'steel',
  'break',
  'explosion',
  'laser',
  'pickup',
  'multiball',
  'life',
  'lost',
  'gameover',
  'clear',
  'victory',
  'pause',
  'resume',
] as const
export type BreakoutSound = (typeof BREAKOUT_SOUNDS)[number]
export interface AudioSettings {
  enabled: boolean
  volume: number
}
export const AUDIO_SETTINGS_KEY = 'mini-games-breakout-audio-v1'
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = { enabled: true, volume: 0.65 }

export function loadAudioSettings(): AudioSettings {
  try {
    const value = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) ?? 'null')
    return {
      enabled: typeof value?.enabled === 'boolean' ? value.enabled : true,
      volume:
        typeof value?.volume === 'number' && Number.isFinite(value.volume)
          ? Math.max(0, Math.min(1, value.volume))
          : DEFAULT_AUDIO_SETTINGS.volume,
    }
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS }
  }
}
export function saveAudioSettings(settings: AudioSettings): void {
  try {
    localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* Session controls still work. */
  }
}

const PRIORITY: Record<BreakoutSound, number> = {
  wall: 0,
  laser: 1,
  brick: 1,
  armor: 2,
  steel: 2,
  break: 2,
  explosion: 3,
  paddle: 4,
  launch: 4,
  pickup: 5,
  multiball: 5,
  life: 5,
  lost: 6,
  gameover: 6,
  clear: 6,
  victory: 6,
  pause: 6,
  resume: 6,
}
interface Voice {
  source: AudioBufferSourceNode
  gain: GainNode
  priority: number
}

/** Gesture-unlocked audio. Coalesces each frame and invalidates pending work on scene changes. */
export class BreakoutAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private limiter: DynamicsCompressorNode | null = null
  private buffers = new Map<BreakoutSound, Promise<AudioBuffer | null>>()
  private voices = new Set<Voice>()
  private pending = new Set<BreakoutSound>()
  private lastPlayed = new Map<BreakoutSound, number>()
  private scheduled = false
  private generation = 0
  private disposed = false
  private abort = new AbortController()
  private explosionTime = -Infinity

  constructor(
    private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS,
    private createContext: () => AudioContext = () => {
      const Ctor = window.AudioContext ?? window.webkitAudioContext
      if (!Ctor) throw new Error('Audio is unavailable')
      return new Ctor()
    },
  ) {}

  unlock(): void {
    if (this.disposed || !this.settings.enabled || this.settings.volume === 0) return
    try {
      if (!this.context) {
        this.context = this.createContext()
        this.master = this.context.createGain()
        this.master.gain.value = this.settings.volume
        this.limiter = this.context.createDynamicsCompressor()
        this.limiter.threshold.value = -10
        this.limiter.knee.value = 8
        this.limiter.ratio.value = 12
        this.limiter.attack.value = 0.003
        this.limiter.release.value = 0.1
        this.master.connect(this.limiter)
        this.limiter.connect(this.context.destination)
        for (const sound of BREAKOUT_SOUNDS) void this.load(sound)
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch {
      /* Missing audio support never prevents playing. */
    }
  }

  setSettings(settings: AudioSettings): void {
    this.settings = { enabled: settings.enabled, volume: Math.max(0, Math.min(1, settings.volume)) }
    if (!settings.enabled || settings.volume === 0) this.stopAll()
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        settings.enabled ? this.settings.volume : 0,
        this.context.currentTime,
        0.015,
      )
  }

  private load(sound: BreakoutSound): Promise<AudioBuffer | null> {
    const context = this.context
    if (!context) return Promise.resolve(null)
    let buffer = this.buffers.get(sound)
    if (!buffer) {
      buffer = fetch(`${import.meta.env?.BASE_URL ?? '/'}audio/breakout/${sound}.wav`, {
        signal: this.abort.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error('Sound unavailable')
          return response.arrayBuffer()
        })
        .then((bytes) => (this.disposed ? null : context.decodeAudioData(bytes)))
        .catch(() => null)
      this.buffers.set(sound, buffer)
    }
    return buffer
  }

  play(sound: BreakoutSound): void {
    if (this.disposed || !this.context || !this.settings.enabled || this.settings.volume === 0)
      return
    this.pending.add(sound)
    if (this.scheduled) return
    this.scheduled = true
    const generation = this.generation
    queueMicrotask(() => {
      if (generation !== this.generation) return
      this.scheduled = false
      const sounds = [...this.pending].sort((a, b) => PRIORITY[b] - PRIORITY[a])
      this.pending.clear()
      for (const effect of sounds) {
        if (sounds.includes('explosion') && ['brick', 'armor', 'break'].includes(effect)) continue
        this.schedule(effect)
      }
    })
  }

  private schedule(sound: BreakoutSound): void {
    const context = this.context!
    const now = context.currentTime
    const cooldown = sound === 'laser' ? 0.12 : sound === 'explosion' ? 0.09 : 0.055
    if (now - (this.lastPlayed.get(sound) ?? -Infinity) < cooldown) return
    this.lastPlayed.set(sound, now)
    const generation = this.generation
    void this.load(sound).then((buffer) => {
      if (
        !buffer ||
        this.disposed ||
        generation !== this.generation ||
        context.state !== 'running' ||
        !this.settings.enabled ||
        this.settings.volume === 0 ||
        context.currentTime - now > 0.25
      )
        return
      if (this.voices.size >= 6) {
        const quietest = [...this.voices].sort((a, b) => a.priority - b.priority)[0]
        if (quietest.priority > PRIORITY[sound]) return
        this.stop(quietest)
      }
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffer
      // Closely spaced explosions remain distinct without accumulating at full volume.
      gain.gain.value =
        sound === 'explosion' && context.currentTime - this.explosionTime < 0.3 ? 0.5 : 1
      if (sound === 'explosion') this.explosionTime = context.currentTime
      source.connect(gain)
      gain.connect(this.master!)
      const voice = { source, gain, priority: PRIORITY[sound] }
      source.onended = () => this.release(voice)
      this.voices.add(voice)
      try {
        source.start()
      } catch {
        this.release(voice)
      }
    })
  }

  private release(voice: Voice): void {
    voice.source.onended = null
    voice.source.disconnect()
    voice.gain.disconnect()
    this.voices.delete(voice)
  }
  private stop(voice: Voice): void {
    voice.source.onended = null
    try {
      voice.source.stop()
    } catch {
      /* Already ended. */
    }
    this.release(voice)
  }
  stopAll(): void {
    this.generation++
    this.pending.clear()
    this.scheduled = false
    this.lastPlayed.clear()
    this.explosionTime = -Infinity
    for (const voice of this.voices) this.stop(voice)
  }
  dispose(): void {
    this.disposed = true
    this.stopAll()
    this.abort.abort()
    this.buffers.clear()
    this.master?.disconnect()
    this.limiter?.disconnect()
    if (this.context) void this.context.close().catch(() => {})
    this.context = null
  }
}
