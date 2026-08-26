import { MAX_TICKS_PER_FRAME, TICK_SECONDS } from '../constants.ts';

interface GameLoopOptions {
  /** 固定步长的逻辑推进，dt 恒为 TICK_SECONDS */
  readonly update: (dt: number) => void;
  /** 渲染，每个 rAF 回调最多执行一次 */
  readonly render: () => void;
}

/**
 * 固定步长主循环。
 *
 * 逻辑以 TICKS_PER_SECOND 恒定频率推进，渲染由 rAF 驱动。二者解耦保证了
 * 碰撞判定与 AI 决策完全确定、不受显示器刷新率影响。
 *
 * 单帧最多补 MAX_TICKS_PER_FRAME 次 tick：切后台再回来时时间差可能达到数十秒，
 * 若不设上限会在一帧内执行上千次逻辑而卡死页面。超出部分直接丢弃。
 */
export class GameLoop {
  private readonly update: (dt: number) => void;
  private readonly render: () => void;
  private accumulator = 0;
  private lastTimeMs = 0;
  private rafId = 0;
  private running = false;

  constructor(options: GameLoopOptions) {
    this.update = options.update;
    this.render = options.render;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTimeMs = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** 丢弃已累积的时间差。用于从暂停/后台恢复，避免瞬间补帧。 */
  resetClock(): void {
    this.lastTimeMs = performance.now();
    this.accumulator = 0;
  }

  private readonly frame = (nowMs: number): void => {
    if (!this.running) {
      return;
    }

    const elapsedSeconds = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;
    this.accumulator += elapsedSeconds;

    let ticks = 0;
    while (this.accumulator >= TICK_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
      this.update(TICK_SECONDS);
      this.accumulator -= TICK_SECONDS;
      ticks += 1;
    }

    // 补帧达到上限说明卡顿严重，丢弃剩余时间而非堆积到下一帧。
    if (ticks >= MAX_TICKS_PER_FRAME) {
      this.accumulator = 0;
    }

    this.render();
    this.rafId = requestAnimationFrame(this.frame);
  };
}
