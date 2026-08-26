import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants.ts';

/**
 * 像素画布。
 *
 * 内部始终以 CANVAS_WIDTH x CANVAS_HEIGHT 的低分辨率绘制，再整数倍放大到
 * 屏幕 —— 非整数倍缩放会让像素边缘出现半透明过渡，破坏像素风。
 * imageSmoothingEnabled = false 关闭插值，保证放大后每个逻辑像素都是锐利方块。
 */
export class PixelCanvas {
  readonly context: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private scale = 1;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;

    const context = canvas.getContext('2d', { alpha: false });
    if (context === null) {
      throw new Error('无法获取 2D 渲染上下文');
    }
    this.context = context;

    this.resize();
    window.addEventListener('resize', this.resize);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
  }

  getScale(): number {
    return this.scale;
  }

  /** 按广场分配的容器宽度计算最大的整数缩放倍数 */
  private readonly resize = (): void => {
    const availableWidth = this.container.clientWidth || window.innerWidth;
    this.scale = Math.max(1, Math.floor(availableWidth / CANVAS_WIDTH));

    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
    this.canvas.style.width = `${CANVAS_WIDTH * this.scale}px`;
    this.canvas.style.height = `${CANVAS_HEIGHT * this.scale}px`;

    // 尺寸变更会重置上下文状态，需重新关闭平滑
    this.context.imageSmoothingEnabled = false;
  };

  /** 用指定颜色清屏 */
  clear(color: string): void {
    this.context.fillStyle = color;
    this.context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}
