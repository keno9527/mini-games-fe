import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/games/tank-battle/constants.ts'

/**
 * 像素画布。
 *
 * 内部始终以 CANVAS_WIDTH x CANVAS_HEIGHT 的低分辨率绘制，再整数倍放大到
 * 屏幕 —— 非整数倍缩放会让像素边缘出现半透明过渡，破坏像素风。
 * imageSmoothingEnabled = false 关闭插值，保证放大后每个逻辑像素都是锐利方块。
 */
export class PixelCanvas {
  readonly context: CanvasRenderingContext2D
  private readonly canvas: HTMLCanvasElement
  private readonly container: HTMLElement
  private scale = 1
  private observer: ResizeObserver | undefined

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas
    this.container = container

    const context = canvas.getContext('2d', { alpha: false })
    if (context === null) {
      throw new Error('无法获取 2D 渲染上下文')
    }
    this.context = context

    this.resize()
    window.addEventListener('resize', this.resize)
    if (typeof ResizeObserver !== 'undefined' && container.parentElement) {
      this.observer = new ResizeObserver(this.resize)
      this.observer.observe(container.parentElement)
    }
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize)
    this.observer?.disconnect()
  }

  getScale(): number {
    return this.scale
  }

  /** 桌面保持整数倍像素缩放；窄屏优先利用可用宽度。 */
  private readonly resize = (): void => {
    const style = window.getComputedStyle?.(this.container)
    const horizontalPadding = style
      ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      : 0
    const availableWidth = Math.max(
      1,
      (this.container.clientWidth || window.innerWidth) - horizontalPadding,
    )
    const fitScale = availableWidth / CANVAS_WIDTH
    const top = this.container.getBoundingClientRect?.().top ?? 0
    const heightScale = Math.max(1, (window.innerHeight - Math.max(0, top) - 90) / CANVAS_HEIGHT)
    const compact = window.matchMedia?.('(max-width: 700px)').matches ?? false
    this.scale = compact ? fitScale : Math.max(1, Math.floor(Math.min(fitScale, heightScale)))

    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT
    this.canvas.style.width = `${CANVAS_WIDTH * this.scale}px`
    this.canvas.style.height = `${CANVAS_HEIGHT * this.scale}px`

    // 尺寸变更会重置上下文状态，需重新关闭平滑
    this.context.imageSmoothingEnabled = false
  }

  /** 用指定颜色清屏 */
  clear(color: string): void {
    this.context.fillStyle = color
    this.context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }
}
