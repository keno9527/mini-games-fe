import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FIELD_OFFSET_X,
  FIELD_OFFSET_Y,
  FIELD_PIXELS,
} from '@/games/tank-battle/constants.ts'
import { COLORS } from '@/games/tank-battle/render/palette.ts'
import { TerrainKind } from '@/games/tank-battle/types.ts'
import type { World } from '@/games/tank-battle/system/World.ts'
import {
  drawBase,
  drawBullet,
  drawExplosion,
  drawPowerUp,
  drawTank,
  drawTerrainCell,
  drawTreeCell,
} from '@/games/tank-battle/render/drawSprites.ts'
import { drawFieldBackground, drawHud } from '@/games/tank-battle/render/Hud.ts'

/**
 * 战场渲染器。
 *
 * 渲染顺序即层级关系，不可调换：
 *   底层地形 → 基地 → 坦克 → 子弹 → 草地 → 道具 → 爆炸 → HUD
 *
 * 草地刻意排在坦克之后 —— 原作中草地会遮蔽坦克，这是重要的战术要素。
 */
export function renderBattlefield(
  context: CanvasRenderingContext2D,
  world: World,
  animationPhase: number,
): void {
  context.fillStyle = COLORS.UI_BACKGROUND
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  context.save()
  context.translate(FIELD_OFFSET_X, FIELD_OFFSET_Y)
  context.beginPath()
  context.rect(0, 0, FIELD_PIXELS, FIELD_PIXELS)
  context.clip()
  drawFieldBackground(context)

  // 1. 底层地形（草地在此跳过）
  world.terrain.forEachCell((cellX, cellY, kind, brickMask) => {
    if (kind === TerrainKind.TREE) {
      return
    }
    drawTerrainCell(context, cellX, cellY, kind, brickMask, animationPhase)
  })

  // 2. 基地
  drawBase(context, world.base)

  // 4. 坦克
  for (const enemy of world.enemies) {
    drawTank(context, enemy)
  }
  for (const player of world.getPlayerTanks()) drawTank(context, player)

  // 5. 子弹
  for (const bullet of world.bullets) {
    drawBullet(context, bullet)
  }

  // 6. 草地：覆盖在坦克与子弹之上
  world.terrain.forEachCell((cellX, cellY, kind) => {
    if (kind === TerrainKind.TREE) {
      drawTreeCell(context, cellX, cellY)
    }
  })

  // Bonuses remain readable even when they appear inside a forest.
  for (const powerUp of world.powerUps) drawPowerUp(context, powerUp)

  // 7. 爆炸：最顶层，草地也遮不住
  for (const explosion of world.explosions) {
    drawExplosion(context, explosion)
  }

  // 8. 信息栏
  context.restore()
  drawHud(context, world)
}
