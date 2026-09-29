import { W, H } from '../breakout/physics'

/** One drag owns the paddle. Coordinates are relative, so touching never teleports it. */
export class PaddleDrag {
  private drag: { id: number; startX: number; paddleX: number; scale: number } | null = null

  begin(id: number, clientX: number, paddleX: number, canvasWidth: number): boolean {
    if (this.drag || canvasWidth <= 0) return false
    this.drag = { id, startX: clientX, paddleX, scale: W / canvasWidth }
    return true
  }

  move(id: number, clientX: number, halfWidth: number): number | null {
    if (!this.drag || this.drag.id !== id) return null
    const x = this.drag.paddleX + (clientX - this.drag.startX) * this.drag.scale
    const bounded = Math.max(halfWidth, Math.min(W - halfWidth, x))
    // Rebase at the edge so reversing direction responds immediately.
    if (x !== bounded) {
      this.drag.startX = clientX
      this.drag.paddleX = bounded
    }
    return bounded
  }

  end(id?: number): number | null {
    if (!this.drag || (id !== undefined && this.drag.id !== id)) return null
    const released = this.drag.id
    this.drag = null
    return released
  }
}

export function fitCanvas(width: number, height: number) {
  const scale = Math.max(0, Math.min(width / W, height / H))
  return { width: Math.floor(W * scale), height: Math.floor(H * scale) }
}
