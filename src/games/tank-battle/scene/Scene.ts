import type { InputSnapshot } from '../types.ts';

/** 场景统一接口：由 SceneManager 驱动 update / render。 */
export interface Scene {
  /** 进入场景时调用一次 */
  onEnter(): void;
  /** 固定步长逻辑更新 */
  update(input: InputSnapshot): void;
  /** 渲染 */
  render(context: CanvasRenderingContext2D): void;
}
