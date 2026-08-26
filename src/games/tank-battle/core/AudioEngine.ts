import { SoundEffect } from '../types.ts';

interface ToneSpec {
  /** 波形 */
  readonly type: OscillatorType;
  /** 起始频率（Hz） */
  readonly startFrequency: number;
  /** 结束频率（Hz），用于滑音 */
  readonly endFrequency: number;
  /** 时长（秒） */
  readonly duration: number;
  /** 峰值音量（0-1） */
  readonly gain: number;
}

/** 每种音效的合成参数，全部为 8-bit 风格的方波/三角波滑音 */
const TONE_SPECS: Readonly<Record<SoundEffect, readonly ToneSpec[]>> = {
  [SoundEffect.FIRE]: [
    { type: 'square', startFrequency: 520, endFrequency: 180, duration: 0.08, gain: 0.16 },
  ],
  [SoundEffect.HIT_TERRAIN]: [
    { type: 'square', startFrequency: 240, endFrequency: 90, duration: 0.06, gain: 0.12 },
  ],
  [SoundEffect.EXPLODE_SMALL]: [
    { type: 'sawtooth', startFrequency: 180, endFrequency: 40, duration: 0.22, gain: 0.2 },
  ],
  [SoundEffect.EXPLODE_BIG]: [
    { type: 'sawtooth', startFrequency: 220, endFrequency: 30, duration: 0.45, gain: 0.26 },
    { type: 'square', startFrequency: 90, endFrequency: 25, duration: 0.5, gain: 0.18 },
  ],
  [SoundEffect.PICKUP]: [
    { type: 'square', startFrequency: 620, endFrequency: 980, duration: 0.12, gain: 0.16 },
    { type: 'square', startFrequency: 980, endFrequency: 1240, duration: 0.1, gain: 0.12 },
  ],
  [SoundEffect.LEVEL_START]: [
    { type: 'triangle', startFrequency: 320, endFrequency: 520, duration: 0.18, gain: 0.18 },
    { type: 'triangle', startFrequency: 520, endFrequency: 760, duration: 0.2, gain: 0.16 },
  ],
  [SoundEffect.GAME_OVER]: [
    { type: 'triangle', startFrequency: 420, endFrequency: 110, duration: 0.7, gain: 0.22 },
  ],
};

/**
 * 程序化 8-bit 音效引擎。
 *
 * 全部音效由 Web Audio 的 OscillatorNode 实时合成，不引入任何音频文件。
 * Safari 要求 AudioContext 必须在用户手势后创建/恢复，因此 AudioContext
 * 采用惰性创建 —— 首次调用 unlock() 时才真正建立。任何失败都静默降级，
 * 不影响游戏进行。
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private unavailable = false;

  /** 在首次用户交互时调用，建立或恢复 AudioContext */
  unlock(): void {
    if (this.unavailable) {
      return;
    }

    try {
      if (this.context === null) {
        const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
        if (AudioContextCtor === undefined) {
          this.unavailable = true;
          return;
        }
        this.context = new AudioContextCtor();
        this.masterGain = this.context.createGain();
        this.masterGain.gain.value = 0.6;
        this.masterGain.connect(this.context.destination);
      }

      if (this.context.state === 'suspended') {
        void this.context.resume();
      }
    } catch {
      // 音频不可用时静默降级，游戏逻辑不受影响
      this.unavailable = true;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  dispose(): void {
    const context = this.context;
    this.context = null;
    this.masterGain = null;

    if (context !== null) {
      void context.close().catch((): void => {
        // 页面卸载期间关闭失败不应影响广场路由切换。
      });
    }
  }

  play(effect: SoundEffect): void {
    if (!this.enabled || this.unavailable) {
      return;
    }

    const context = this.context;
    const masterGain = this.masterGain;
    if (context === null || masterGain === null || context.state !== 'running') {
      return;
    }

    try {
      const startTime = context.currentTime;
      for (const spec of TONE_SPECS[effect]) {
        this.playTone(context, masterGain, spec, startTime);
      }
    } catch {
      // 单次播放失败不影响后续
    }
  }

  private playTone(
    context: AudioContext,
    destination: GainNode,
    spec: ToneSpec,
    startTime: number,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(spec.startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, spec.endFrequency),
      startTime + spec.duration,
    );

    // 快速起音 + 指数衰减，模拟 FC 音源的包络
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(spec.gain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + spec.duration);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + spec.duration + 0.02);
  }
}
