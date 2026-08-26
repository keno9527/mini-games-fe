import { CELL_SIZE } from '../constants.ts';
import { nextEntityId } from '../core/ids.ts';
import { PowerUpKind, type Rect } from '../types.ts';

/** 道具闪烁周期（逻辑帧） */
const BLINK_PERIOD = 32;

/** 道具实体：占一个格子，被玩家坦克覆盖时触发拾取。 */
export class PowerUp {
  readonly id: string;
  readonly kind: PowerUpKind;
  readonly cellX: number;
  readonly cellY: number;

  /** 闪烁相位，仅影响渲染 */
  blinkPhase = 0;
  alive = true;

  constructor(kind: PowerUpKind, cellX: number, cellY: number) {
    this.id = nextEntityId('powerup');
    this.kind = kind;
    this.cellX = cellX;
    this.cellY = cellY;
  }

  getRect(): Rect {
    return {
      x: this.cellX * CELL_SIZE,
      y: this.cellY * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
    };
  }

  /** 当前帧是否处于可见相位 */
  isVisible(): boolean {
    return this.blinkPhase < BLINK_PERIOD / 2;
  }

  tickTimers(): void {
    this.blinkPhase = (this.blinkPhase + 1) % BLINK_PERIOD;
  }
}
