import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/games/tank-battle/constants.ts'

/**
 * 像素画布。
 *
 * 保持固定逻辑分辨率和宽高比。标题页使用原有整数倍缩放，战斗时适配可用视口。
 * 关闭绘图插值，并配合 CSS image-rendering: pixelated 保留像素风。
 */
export class PixelCanvas {
  readonly context: CanvasRenderingContext2D
  private readonly canvas: HTMLCanvasElement
  private readonly container: HTMLElement
  private scale = 1
  private observer: ResizeObserver | undefined
  private viewport: HTMLElement | null = null

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

  /** 进入战斗后以独立视口测量，避免面板收紧后限制下一次放大。 */
  setViewport(viewport: HTMLElement | null): void {
    if (this.viewport) this.observer?.unobserve(this.viewport)
    this.viewport = viewport
    if (viewport) this.observer?.observe(viewport)
    else this.container.parentElement?.style.removeProperty('--tank-panel-width')
    this.resize()
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize)
    this.observer?.disconnect()
  }

  getScale(): number {
    return this.scale
  }

  /** 战斗同时受可用宽高约束；标题页维持原有展示。 */
  private readonly resize = (): void => {
    const style = window.getComputedStyle?.(this.container)
    const horizontalPadding = style
      ? (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      : 0
    let availableWidth = Math.max(
      1,
      (this.container.clientWidth || window.innerWidth) - horizontalPadding,
    )
    const shell = this.container.parentElement
    if (this.viewport && shell) {
      const viewportStyle = window.getComputedStyle(this.viewport)
      const shellStyle = window.getComputedStyle(shell)
      const value = (input: string) => parseFloat(input) || 0
      const borderX = value(shellStyle.borderLeftWidth) + value(shellStyle.borderRightWidth)
      const borderY = value(shellStyle.borderTopWidth) + value(shellStyle.borderBottomWidth)
      const paddingY = value(style.paddingTop) + value(style.paddingBottom)
      const sideWidth = value(shellStyle.getPropertyValue('--tank-side-width'))
      const viewportWidth =
        this.viewport.clientWidth -
        value(viewportStyle.paddingLeft) -
        value(viewportStyle.paddingRight)
      const viewportHeight =
        this.viewport.clientHeight -
        value(viewportStyle.paddingTop) -
        value(viewportStyle.paddingBottom)
      const chromeHeight = Array.from(
        shell.querySelectorAll<HTMLElement>('[data-tank-chrome]'),
      ).reduce((height, element) => height + element.offsetHeight, 0)
      availableWidth = Math.max(1, viewportWidth - borderX - horizontalPadding - sideWidth)
      const availableHeight = Math.max(1, viewportHeight - borderY - paddingY - chromeHeight)
      this.scale = Math.min(availableWidth / CANVAS_WIDTH, availableHeight / CANVAS_HEIGHT)
      // 窄屏保留按钮的可用宽度；横屏触控两侧区域由 CSS 显式预留。
      const panelWidth = Math.min(
        viewportWidth,
        Math.max(340, CANVAS_WIDTH * this.scale + horizontalPadding + borderX + sideWidth),
      )
      shell.style.setProperty('--tank-panel-width', `${panelWidth}px`)
    } else {
      const fitScale = availableWidth / CANVAS_WIDTH
      const top = this.container.getBoundingClientRect?.().top ?? 0
      const heightScale = Math.max(1, (window.innerHeight - Math.max(0, top) - 90) / CANVAS_HEIGHT)
      const compact = window.matchMedia?.('(max-width: 700px)').matches ?? false
      this.scale = compact
        ? fitScale
        : Math.max(1, Math.floor(Math.min(fitScale, Math.max(2, heightScale))))
    }

    if (this.canvas.width !== CANVAS_WIDTH) this.canvas.width = CANVAS_WIDTH
    if (this.canvas.height !== CANVAS_HEIGHT) this.canvas.height = CANVAS_HEIGHT
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
