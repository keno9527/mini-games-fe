import type { Rect } from '../types.ts';

/** 两个轴对齐矩形是否相交（边缘接触不算相交） */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

/** 把数值限制在 [min, max] 区间 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/** 四舍五入到最近的 step 倍数 */
export function snapTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
