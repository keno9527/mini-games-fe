import { SoundEffect } from '@/games/tank-battle/types.ts'

// Battle City samples from dderevjanik/battle-city-reforged/data/audio.
// Source attribution: https://github.com/dderevjanik/battle-city-reforged/blob/main/LICENSE.md
// Original recordings remain third-party assets; the upstream code license does not cover them.
const FILES: Record<SoundEffect, string> = {
  [SoundEffect.FIRE]: 'fire',
  [SoundEffect.HIT_TERRAIN]: 'hit-brick',
  [SoundEffect.HIT_STEEL]: 'hit-steel',
  [SoundEffect.HIT_ARMOR]: 'hit-enemy',
  [SoundEffect.EXPLODE_SMALL]: 'enemy-explosion',
  [SoundEffect.EXPLODE_BIG]: 'player-explosion',
  [SoundEffect.BONUS_APPEAR]: 'powerup-appear',
  [SoundEffect.PICKUP]: 'powerup-pickup',
  [SoundEffect.EXTRA_LIFE]: 'life',
  [SoundEffect.PAUSE]: 'pause',
  [SoundEffect.SCORE_TICK]: 'score',
  [SoundEffect.MOTOR]: 'tank-move',
  [SoundEffect.IDLE]: 'tank-idle',
  [SoundEffect.ICE]: 'ice',
  [SoundEffect.VICTORY]: 'victory',
  [SoundEffect.HIGH_SCORE]: 'high-score',
  [SoundEffect.LEVEL_START]: 'level-intro',
  [SoundEffect.GAME_OVER]: 'game-over',
}

type Motor = SoundEffect.MOTOR | SoundEffect.IDLE | null

/** Gesture-unlocked sample playback. Pending loads cannot outlive their scene. */
export class AudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private readonly buffers = new Map<SoundEffect, Promise<AudioBuffer | null>>()
  private readonly voices = new Map<AudioBufferSourceNode, GainNode>()
  private readonly lastPlayed = new Map<SoundEffect, number>()
  private readonly abort = new AbortController()
  private motor: Motor = null
  private motorSource: AudioBufferSourceNode | null = null
  private motorRevision = 0
  private generation = 0
  private enabled = true
  private unavailable = false

  unlock(): void {
    if (this.unavailable) return
    try {
      if (this.context === null) {
        const Ctor = window.AudioContext ?? window.webkitAudioContext
        if (!Ctor) {
          this.unavailable = true
          return
        }
        this.context = new Ctor()
        this.masterGain = this.context.createGain()
        this.masterGain.gain.value = this.enabled ? 0.5 : 0
        this.masterGain.connect(this.context.destination)
        for (const effect of Object.values(SoundEffect)) void this.load(effect)
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch {
      this.unavailable = true
    }
  }

  private load(effect: SoundEffect): Promise<AudioBuffer | null> {
    const context = this.context
    if (!context) return Promise.resolve(null)
    let pending = this.buffers.get(effect)
    if (!pending) {
      const base = import.meta.env?.BASE_URL ?? '/'
      pending = fetch(base + 'audio/tank-battle/' + FILES[effect] + '.mp3', {
        signal: this.abort.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error('Audio asset unavailable')
          return response.arrayBuffer()
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .then((buffer) => this.trimSilence(context, buffer))
        .catch(() => null)
      this.buffers.set(effect, pending)
    }
    return pending
  }

  // Most source clips contain a full second of trailing silence. Remove only the
  // outer padding so short effects release voices promptly and loops stay continuous.
  private trimSilence(context: AudioContext, buffer: AudioBuffer): AudioBuffer {
    let first = buffer.length
    let last = -1
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const samples = buffer.getChannelData(channel)
      let start = 0
      let end = samples.length - 1
      while (start <= end && Math.abs(samples[start]) < 0.001) start += 1
      while (end >= start && Math.abs(samples[end]) < 0.001) end -= 1
      first = Math.min(first, start)
      last = Math.max(last, end)
    }
    if (last < first) return buffer
    const padding = Math.ceil(buffer.sampleRate * 0.003)
    first = Math.max(0, first - padding)
    last = Math.min(buffer.length, last + padding + 1)
    if (first === 0 && last === buffer.length) return buffer
    const trimmed = context.createBuffer(buffer.numberOfChannels, last - first, buffer.sampleRate)
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1)
      trimmed.copyToChannel(buffer.getChannelData(channel).subarray(first, last), channel)
    return trimmed
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stopAll()
    if (this.masterGain) this.masterGain.gain.value = enabled ? 0.5 : 0
  }

  isEnabled(): boolean {
    return this.enabled
  }

  private stop(source: AudioBufferSourceNode): void {
    source.onended = null
    try {
      source.stop()
    } catch {
      /* Already ended. */
    }
    source.disconnect()
    this.voices.get(source)?.disconnect()
    this.voices.delete(source)
  }

  stopAll(): void {
    this.generation += 1
    this.motorRevision += 1
    for (const source of this.voices.keys()) this.stop(source)
    this.motor = null
    this.motorSource = null
    this.lastPlayed.clear()
  }

  dispose(): void {
    this.stopAll()
    this.unavailable = true
    this.abort.abort()
    this.buffers.clear()
    const context = this.context
    this.context = null
    this.masterGain = null
    if (context) void context.close().catch(() => {})
  }

  play(effect: SoundEffect): void {
    const context = this.context
    if (!this.enabled || !context || this.unavailable) return
    const now = context.currentTime
    if (now - (this.lastPlayed.get(effect) ?? -Infinity) < 0.06) return
    this.lastPlayed.set(effect, now)
    const generation = this.generation
    void this.load(effect).then((buffer) => {
      if (buffer && generation === this.generation && context.currentTime - now < 1)
        this.start(buffer)
    })
  }

  /** Schedule ending music in sequence instead of masking the game-over cue. */
  playSequence(effects: readonly SoundEffect[]): void {
    if (!this.enabled || !this.context || this.unavailable) return
    const generation = this.generation
    void Promise.all(effects.map((effect) => this.load(effect))).then((buffers) => {
      if (generation !== this.generation || !this.context) return
      let offset = 0
      for (const buffer of buffers) {
        if (!buffer) continue
        this.start(buffer, false, offset)
        offset += buffer.duration
      }
    })
  }

  /** One shared engine loop for both players, updated from actual movement. */
  setMotor(effect: Motor): void {
    if (!this.enabled || !this.context || this.unavailable || this.motor === effect) return
    this.motor = effect
    const revision = ++this.motorRevision
    if (this.motorSource) this.stop(this.motorSource)
    this.motorSource = null
    if (effect === null) return
    void this.load(effect).then((buffer) => {
      if (buffer && revision === this.motorRevision) this.motorSource = this.start(buffer, true)
    })
  }

  private start(buffer: AudioBuffer, loop = false, offset = 0): AudioBufferSourceNode | null {
    const context = this.context
    if (!this.enabled || !context || !this.masterGain || context.state === 'closed') return null
    try {
      if (this.voices.size >= 16) {
        const oldest = [...this.voices.keys()].find((source) => source !== this.motorSource)
        if (oldest) this.stop(oldest)
      }
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffer
      source.loop = loop
      gain.gain.value = loop ? 0.24 : 0.8
      source.connect(gain)
      gain.connect(this.masterGain)
      this.voices.set(source, gain)
      source.onended = () => {
        source.disconnect()
        gain.disconnect()
        this.voices.delete(source)
      }
      source.start(context.currentTime + offset)
      return source
    } catch {
      return null
    }
  }
}
