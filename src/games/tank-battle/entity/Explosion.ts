import { EXPLOSION_TICKS } from '../constants.ts';
import { nextEntityId } from '../core/ids.ts';

/** 爆炸动画实体：纯计时器，渲染层按进度选择帧。 */
export class Explosion {
  readonly id: string;
  /** 爆炸中心的逻辑像素坐标 */
  readonly centerX: number;
  readonly centerY: number;
  /** 大爆炸用于坦克与基地，小爆炸用于子弹命中地形 */
  readonly big: boolean;

  ticksLeft: number;
  alive = true;

  constructor(centerX: number, centerY: number, big: boolean) {
    this.id = nextEntityId('explosion');
    this.centerX = centerX;
    this.centerY = centerY;
    this.big = big;
    this.ticksLeft = big ? EXPLOSION_TICKS : Math.floor(EXPLOSION_TICKS / 2);
  }

  /** 动画进度 0 → 1 */
  getProgress(): number {
    const total = this.big ? EXPLOSION_TICKS : Math.floor(EXPLOSION_TICKS / 2);
    return 1 - this.ticksLeft / total;
  }

  tickTimers(): void {
    this.ticksLeft -= 1;
    if (this.ticksLeft <= 0) {
      this.alive = false;
    }
  }
}
