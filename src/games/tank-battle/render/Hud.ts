import {
  CELL_SIZE,
  FIELD_PIXELS,
  FIELD_OFFSET_X,
  FIELD_OFFSET_Y,
  SIDEBAR_WIDTH,
  TICKS_PER_SECOND,
} from '@/games/tank-battle/constants.ts'
import { drawText } from '@/games/tank-battle/render/drawSprites.ts'
import { COLORS } from '@/games/tank-battle/render/palette.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

const MINI_TANK = [
  '  11    ',
  '1 11 1  ',
  '111111  ',
  '111111  ',
  '111111  ',
  '1 11 1  ',
  '1    1  ',
  '        ',
]
const HUD_FONT: Readonly<Record<string, readonly string[]>> = {
  '0': ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
  '1': ['00110', '01110', '00110', '00110', '00110', '00110', '01111'],
  '2': ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
  '3': ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
  '4': ['00110', '01110', '11010', '11010', '11111', '00010', '00010'],
  '5': ['11111', '11000', '11000', '11110', '00011', '00011', '11110'],
  '6': ['01110', '11000', '11000', '11110', '11011', '11011', '01110'],
  '7': ['11111', '00011', '00110', '00110', '01100', '01100', '01100'],
  '8': ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
  '9': ['01110', '11011', '11011', '01111', '00011', '00011', '01110'],
  P: ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
}
function drawHudNumber(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  context.fillStyle = COLORS.TEXT_DIM
  for (const [index, char] of [...text].entries()) {
    HUD_FONT[char]?.forEach((row, dy) =>
      [...row].forEach((pixel, dx) => {
        if (pixel === '1') context.fillRect(x + index * 8 + dx, y + dy, 1, 1)
      }),
    )
  }
}
function drawMiniTank(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
): void {
  context.fillStyle = color
  MINI_TANK.forEach((row, dy) =>
    [...row].forEach((pixel, dx) => {
      if (pixel === '1') context.fillRect(x + dx, y + dy, 1, 1)
    }),
  )
}

/** 原版式坦克计数、生命与关卡旗；网页辅助信息收进灰框底边。 */
export function drawHud(context: CanvasRenderingContext2D, world: World): void {
  const originX = FIELD_OFFSET_X + FIELD_PIXELS
  const x = originX + 8
  context.fillStyle = COLORS.UI_BACKGROUND
  context.fillRect(originX, 0, SIDEBAR_WIDTH, FIELD_PIXELS + FIELD_OFFSET_Y * 2)
  for (let index = 0; index < world.pendingEnemies.length; index += 1) {
    drawMiniTank(
      context,
      x + (index % 2) * 8,
      FIELD_OFFSET_Y + Math.floor(index / 2) * 8,
      COLORS.TEXT_DIM,
    )
  }
  drawHudNumber(context, '1P', x, 128)
  drawMiniTank(context, x, 139, COLORS.PLAYER_TREAD)
  drawHudNumber(context, String(Math.min(99, world.playerLives)), x + 8, 139)
  if (world.player && world.player.star > 0)
    drawText(context, `ST${world.player.star}`, x, 153, COLORS.TEXT_DIM)
  context.fillStyle = COLORS.TEXT_DIM
  context.fillRect(x, 184, 2, 18)
  context.fillStyle = COLORS.BRICK_MAIN
  for (let row = 0; row < 8; row += 1)
    context.fillRect(x + 2, 184 + row, 12 - Math.floor(row / 2), 1)
  drawHudNumber(context, String(world.levelIndex + 1), x + 5, 206)

  const bottomY = FIELD_OFFSET_Y + FIELD_PIXELS + 5
  drawText(
    context,
    `SC ${String(Math.min(999999, world.score)).padStart(6, '0')}`,
    FIELD_OFFSET_X,
    bottomY,
    COLORS.TEXT_DIM,
  )
  drawText(
    context,
    `HI ${String(Math.min(999999, world.highScore)).padStart(6, '0')}`,
    FIELD_OFFSET_X + 44,
    bottomY,
    COLORS.TEXT_DIM,
  )
  const effects: readonly (readonly [string, number])[] = [
    ['STOP', world.freezeTicks],
    ['WALL', world.shovelTicks],
    ['SHLD', world.player?.shieldTicks ?? 0],
  ]
  let effectX = FIELD_OFFSET_X + 92
  for (const [label, ticks] of effects) {
    if (ticks <= 0) continue
    drawText(
      context,
      `${label} ${Math.ceil(ticks / TICKS_PER_SECOND)}`,
      effectX,
      bottomY,
      COLORS.TEXT_DIM,
    )
    effectX += 32
  }
}

/** 战场区域的黑色底 */
export function drawFieldBackground(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.FIELD_BACKGROUND
  context.fillRect(0, 0, FIELD_PIXELS, FIELD_PIXELS)
}

/** 居中绘制一行提示文本（用于关卡开场 / 结算 / 暂停） */
export function drawCenteredBanner(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  color: string,
  scale = 1,
): void {
  const lineHeight = 8 * scale
  const totalHeight = lines.length * lineHeight
  let lineY = Math.round((FIELD_PIXELS - totalHeight) / 2)

  for (const line of lines) {
    const width = line.length * (3 + 1) * scale - scale
    const lineX = Math.round((FIELD_PIXELS - width) / 2)
    drawText(context, line, lineX, lineY, color, scale)
    lineY += lineHeight
  }
}

/** 半透明黑幕，用于暂停与结算画面压暗战场 */
export function drawDimOverlay(context: CanvasRenderingContext2D, alpha: number): void {
  context.save()
  context.globalAlpha = alpha
  context.fillStyle = '#000000'
  context.fillRect(0, 0, FIELD_PIXELS, FIELD_PIXELS)
  context.restore()
}

/** 关卡开场的黑色横幕拉开动画。progress 0 → 1 */
export function drawCurtain(context: CanvasRenderingContext2D, progress: number): void {
  const half = Math.round((FIELD_PIXELS / 2) * (1 - progress))
  if (half <= 0) {
    return
  }
  context.fillStyle = '#5c5c5c'
  context.fillRect(0, 0, FIELD_PIXELS, half)
  context.fillRect(0, FIELD_PIXELS - half, FIELD_PIXELS, half)
}

/** 计算格坐标对应的像素原点，供渲染层复用 */
export function cellToPixel(cell: number): number {
  return cell * CELL_SIZE
}
