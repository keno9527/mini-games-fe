import { CELL_SIZE, FIELD_PIXELS, SIDEBAR_WIDTH, TANK_SIZE } from '@/games/tank-battle/constants.ts'
import { TANK_SPRITES } from '@/games/tank-battle/data/sprites.ts'
import { Direction } from '@/games/tank-battle/types.ts'
import { drawText } from '@/games/tank-battle/render/drawSprites.ts'
import { COLORS } from '@/games/tank-battle/render/palette.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/** 剩余敌人图标的格子尺寸 */
const ENEMY_ICON_SIZE = 7

/** 单行最多排 2 个敌人图标 */
const ENEMY_ICONS_PER_ROW = 2

/**
 * 右侧信息栏：剩余敌人数、玩家生命、关卡编号、分数与最高分。
 */
export function drawHud(context: CanvasRenderingContext2D, world: World): void {
  const originX = FIELD_PIXELS

  context.fillStyle = COLORS.UI_BACKGROUND
  context.fillRect(originX, 0, SIDEBAR_WIDTH, FIELD_PIXELS)

  drawEnemyIcons(context, originX + 6, 8, world.getEnemiesRemaining())

  const infoY = 8 + Math.ceil(20 / ENEMY_ICONS_PER_ROW) * ENEMY_ICON_SIZE + 10

  // 玩家标识与剩余生命
  drawText(context, '1P', originX + 6, infoY, COLORS.TEXT_DIM)
  drawPlayerLifeIcon(context, originX + 6, infoY + 8)
  drawText(context, String(world.playerLives), originX + 18, infoY + 10, COLORS.TEXT_DIM)

  // 关卡编号
  drawText(context, 'LV', originX + 6, infoY + 26, COLORS.TEXT_DIM)
  drawText(context, String(world.levelIndex + 1), originX + 6, infoY + 34, COLORS.TEXT_DIM)

  // 分数
  drawText(context, 'SC', originX + 6, infoY + 48, COLORS.TEXT_DIM)
  drawText(context, formatScore(world.score), originX + 6, infoY + 56, COLORS.TEXT_PRIMARY)

  // 最高分
  drawText(context, 'HI', originX + 6, infoY + 70, COLORS.TEXT_DIM)
  drawText(context, formatScore(world.highScore), originX + 6, infoY + 78, COLORS.TEXT_HIGHLIGHT)

  drawStatusFlags(context, originX + 6, infoY + 94, world)
}

/** 剩余敌人以小方块图标堆叠展示 */
function drawEnemyIcons(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  count: number,
): void {
  context.fillStyle = COLORS.TEXT_DIM
  for (let index = 0; index < count; index += 1) {
    const col = index % ENEMY_ICONS_PER_ROW
    const row = Math.floor(index / ENEMY_ICONS_PER_ROW)
    context.fillRect(
      originX + col * ENEMY_ICON_SIZE,
      originY + row * ENEMY_ICON_SIZE,
      ENEMY_ICON_SIZE - 2,
      ENEMY_ICON_SIZE - 2,
    )
  }
}

/** 生命图标：缩略的玩家坦克轮廓 */
function drawPlayerLifeIcon(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
): void {
  const sprite = TANK_SPRITES[Direction.UP]
  // 按 1/2 采样绘制成 8x8 的缩略图
  context.fillStyle = COLORS.PLAYER_BODY
  for (let row = 0; row < TANK_SIZE; row += 2) {
    const line = sprite[row]
    for (let col = 0; col < TANK_SIZE; col += 2) {
      if (line[col] === ' ') {
        continue
      }
      context.fillRect(originX + col / 2, originY + row / 2, 1, 1)
    }
  }
}

/** 冻结 / 铲子等临时状态提示 */
function drawStatusFlags(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  world: World,
): void {
  let lineY = originY

  if (world.freezeTicks > 0) {
    drawText(context, 'STOP', originX, lineY, COLORS.SHIELD_OUTER)
    lineY += 8
  }
  if (world.shovelTicks > 0) {
    drawText(context, 'WALL', originX, lineY, COLORS.STEEL_LIGHT)
    lineY += 8
  }
  if (world.player !== null && world.player.star > 0) {
    drawText(context, `ST${world.player.star}`, originX, lineY, COLORS.TEXT_HIGHLIGHT)
  }
}

/** 分数补零到 6 位，避免位数变化导致排版跳动 */
function formatScore(score: number): string {
  return String(Math.min(score, 999999)).padStart(6, '0')
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
