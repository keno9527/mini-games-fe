import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/games/tank-battle/constants.ts'
import { drawText, measureText } from '@/games/tank-battle/render/drawSprites.ts'
import { COLORS } from '@/games/tank-battle/render/palette.ts'
import type { InputSnapshot } from '@/games/tank-battle/types.ts'
import type { Scene } from '@/games/tank-battle/scene/Scene.ts'

interface GameOverSceneCallbacks {
  readonly onRestart: () => void
}

interface GameOverStats {
  readonly canRetry: boolean
  readonly victory: boolean
  readonly score: number
  readonly highScore: number
  readonly levelReached: number
}

/** 结束画面：区分通关与失败，显示战绩并等待重开。 */
export class GameOverScene implements Scene {
  private readonly callbacks: GameOverSceneCallbacks
  private readonly getStats: () => GameOverStats
  private blinkPhase = 0
  /** 入场后的输入锁定帧数，避免死亡瞬间的按键立即重开 */
  private inputLockTicks = 0
  private restartPending = false

  constructor(callbacks: GameOverSceneCallbacks, getStats: () => GameOverStats) {
    this.callbacks = callbacks
    this.getStats = getStats
  }

  onEnter(): void {
    this.blinkPhase = 0
    this.inputLockTicks = 45
    this.restartPending = false
  }

  update(input: InputSnapshot): void {
    this.blinkPhase = (this.blinkPhase + 1) % 60

    if (this.inputLockTicks > 0) {
      this.restartPending ||= input.confirmEdge
      this.inputLockTicks -= 1
      if (this.inputLockTicks === 0 && this.restartPending) this.callbacks.onRestart()
      return
    }
    if (input.confirmEdge) {
      this.callbacks.onRestart()
    }
  }

  render(context: CanvasRenderingContext2D): void {
    const stats = this.getStats()

    context.fillStyle = COLORS.FIELD_BACKGROUND
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (stats.victory) {
      drawCentered(context, 'ALL CLEAR', 46, COLORS.TEXT_HIGHLIGHT, 2)
      drawCentered(context, 'THE EAGLE IS SAFE', 72, COLORS.BASE_EAGLE, 1)
    } else {
      drawCentered(context, 'GAME OVER', 46, COLORS.EXPLOSION_OUTER, 2)
      drawCentered(context, 'DEFENSE FAILED', 72, COLORS.TEXT_PRIMARY, 1)
    }

    drawCentered(context, `STAGE ${stats.levelReached}`, 100, COLORS.TEXT_PRIMARY, 1)
    drawCentered(
      context,
      `SCORE ${String(stats.score).padStart(6, '0')}`,
      114,
      COLORS.TEXT_PRIMARY,
      1,
    )
    drawCentered(
      context,
      `HI ${String(stats.highScore).padStart(6, '0')}`,
      128,
      COLORS.TEXT_HIGHLIGHT,
      1,
    )

    if (this.inputLockTicks <= 0 && this.blinkPhase < 40) {
      drawCentered(
        context,
        stats.canRetry ? 'SELECT RETRY OR NEW GAME' : 'PRESS START TO RETRY',
        160,
        COLORS.TEXT_PRIMARY,
        1,
      )
    }
  }
}

function drawCentered(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  color: string,
  scale: number,
): void {
  const width = measureText(text, scale)
  drawText(context, text, Math.round((CANVAS_WIDTH - width) / 2), y, color, scale)
}
