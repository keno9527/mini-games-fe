import { SoundEffect } from '@/games/tank-battle/types.ts'

interface ToneSpec {
  readonly type: OscillatorType | 'noise'
  readonly startFrequency: number
  readonly endFrequency: number
  readonly duration: number
  readonly gain: number
  readonly delay?: number
}

function note(frequency: number, delay: number, duration = 0.11): ToneSpec {
  return {
    type: 'square',
    startFrequency: frequency,
    endFrequency: frequency,
    duration,
    gain: 0.12,
    delay,
  }
}

/** Original Web Audio arrangements inspired by the FC pulse/triangle/noise channels.
 * No ROM audio or third-party recordings are bundled. Notes are scheduled sequentially.
 */
const TONE_SPECS: Readonly<Record<SoundEffect, readonly ToneSpec[]>> = {
  [SoundEffect.FIRE]: [
    { type: 'square', startFrequency: 880, endFrequency: 110, duration: 0.075, gain: 0.14 },
  ],
  [SoundEffect.HIT_TERRAIN]: [
    { type: 'noise', startFrequency: 1400, endFrequency: 180, duration: 0.07, gain: 0.12 },
  ],
  [SoundEffect.HIT_STEEL]: [note(1760, 0, 0.04), note(880, 0.04, 0.04)],
  [SoundEffect.HIT_ARMOR]: [note(330, 0, 0.045), note(660, 0.045, 0.045)],
  [SoundEffect.EXPLODE_SMALL]: [
    { type: 'noise', startFrequency: 1800, endFrequency: 80, duration: 0.24, gain: 0.25 },
    { type: 'triangle', startFrequency: 110, endFrequency: 30, duration: 0.22, gain: 0.16 },
  ],
  [SoundEffect.EXPLODE_BIG]: [
    { type: 'noise', startFrequency: 2200, endFrequency: 40, duration: 0.6, gain: 0.3 },
    { type: 'triangle', startFrequency: 160, endFrequency: 25, duration: 0.5, gain: 0.23 },
  ],
  [SoundEffect.BONUS_APPEAR]: [note(1046, 0, 0.07), note(1568, 0.08, 0.12)],
  [SoundEffect.PICKUP]: [note(659, 0), note(880, 0.11), note(1319, 0.22, 0.18)],
  [SoundEffect.EXTRA_LIFE]: [note(523, 0), note(659, 0.1), note(784, 0.2), note(1046, 0.3, 0.3)],
  [SoundEffect.PAUSE]: [note(659, 0, 0.06), note(880, 0.07, 0.06)],
  [SoundEffect.SCORE_TICK]: [note(880, 0, 0.028)],
  [SoundEffect.MOTOR]: [
    { type: 'square', startFrequency: 55, endFrequency: 42, duration: 0.045, gain: 0.025 },
  ],
  [SoundEffect.LEVEL_START]: [
    note(392, 0),
    note(523, 0.13),
    note(659, 0.26),
    note(784, 0.39, 0.2),
    note(659, 0.65),
    note(784, 0.78),
    note(1046, 0.91, 0.35),
    { type: 'triangle', startFrequency: 131, endFrequency: 131, duration: 1.3, gain: 0.1 },
  ],
  [SoundEffect.GAME_OVER]: [
    note(523, 0, 0.22),
    note(494, 0.25, 0.22),
    note(440, 0.5, 0.22),
    note(262, 0.75, 0.55),
  ],
}

/** Lazy, gesture-unlocked audio. All scheduled voices are stopped on pause/unmount. */
export class AudioEngine {
  private context: AudioContext | null = null
  private masterGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private readonly voices = new Map<AudioScheduledSourceNode, AudioNode[]>()
  private readonly lastPlayed = new Map<SoundEffect, number>()
  private enabled = true
  private unavailable = false

  unlock(): void {
    if (this.unavailable) return
    try {
      if (this.context === null) {
        const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext
        if (AudioContextCtor === undefined) {
          this.unavailable = true
          return
        }
        this.context = new AudioContextCtor()
        this.masterGain = this.context.createGain()
        this.masterGain.gain.value = this.enabled ? 0.5 : 0
        this.masterGain.connect(this.context.destination)
        this.noiseBuffer = this.context.createBuffer(
          1,
          this.context.sampleRate,
          this.context.sampleRate,
        )
        const samples = this.noiseBuffer.getChannelData(0)
        // A deterministic shift register produces a chip-like noise source.
        let register = 1
        for (let i = 0; i < samples.length; i += 1) {
          const bit = (register ^ (register >> 1)) & 1
          register = (register >> 1) | (bit << 14)
          samples[i] = (register & 1) * 2 - 1
        }
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    } catch {
      this.unavailable = true
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) this.stopAll()
    if (this.masterGain !== null) this.masterGain.gain.value = enabled ? 0.5 : 0
  }

  isEnabled(): boolean {
    return this.enabled
  }

  stopAll(): void {
    for (const [source, nodes] of this.voices) {
      source.onended = null
      try {
        source.stop()
      } catch {
        /* A voice may already have ended. */
      }
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
    this.voices.clear()
    this.lastPlayed.clear()
  }

  dispose(): void {
    this.stopAll()
    const context = this.context
    this.context = null
    this.masterGain = null
    this.noiseBuffer = null
    if (context !== null) void context.close().catch(() => {})
  }

  play(effect: SoundEffect): void {
    const context = this.context
    const destination = this.masterGain
    if (
      !this.enabled ||
      this.unavailable ||
      context === null ||
      destination === null ||
      context.state !== 'running'
    )
      return
    const now = context.currentTime
    // Simultaneous hits share one sound and bounded polyphony avoids clipping.
    if (now - (this.lastPlayed.get(effect) ?? -Infinity) < 0.035 || this.voices.size >= 24) return
    this.lastPlayed.set(effect, now)
    try {
      for (const spec of TONE_SPECS[effect])
        this.playTone(context, destination, spec, now + (spec.delay ?? 0))
    } catch {
      // Audio failure must not stop the game loop.
    }
  }

  private playTone(
    context: AudioContext,
    destination: GainNode,
    spec: ToneSpec,
    start: number,
  ): void {
    const gain = context.createGain()
    let source: AudioScheduledSourceNode
    const nodes: AudioNode[] = [gain]
    if (spec.type === 'noise') {
      const noise = context.createBufferSource()
      noise.buffer = this.noiseBuffer
      noise.loop = true
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(spec.startFrequency, start)
      filter.frequency.exponentialRampToValueAtTime(spec.endFrequency, start + spec.duration)
      noise.connect(filter)
      filter.connect(gain)
      nodes.push(filter)
      source = noise
    } else {
      const oscillator = context.createOscillator()
      oscillator.type = spec.type
      oscillator.frequency.setValueAtTime(spec.startFrequency, start)
      oscillator.frequency.exponentialRampToValueAtTime(spec.endFrequency, start + spec.duration)
      oscillator.connect(gain)
      source = oscillator
    }
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(spec.gain, start + 0.005)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration)
    gain.connect(destination)
    this.voices.set(source, nodes)
    source.onended = () => {
      this.voices.delete(source)
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
    source.start(start)
    source.stop(start + spec.duration + 0.01)
  }
}
