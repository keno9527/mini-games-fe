import { CELL_SIZE } from '../constants.ts';
import { BASE_CELL } from '../data/levels.ts';
import type { Rect } from '../types.ts';

/** 老鹰基地：被击毁即游戏失败。 */
export class Base {
  readonly cellX: number = BASE_CELL[0];
  readonly cellY: number = BASE_CELL[1];

  destroyed = false;

  getRect(): Rect {
    return {
      x: this.cellX * CELL_SIZE,
      y: this.cellY * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
    };
  }

  destroy(): void {
    this.destroyed = true;
  }

  reset(): void {
    this.destroyed = false;
  }
}
