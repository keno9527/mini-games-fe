import {
  BRICK_SUB,
  BRICK_SUB_SIZE,
  BULLET_SIZE,
  CELL_SIZE,
  TANK_SIZE,
} from '@/games/tank-battle/constants.ts'
import {
  BASE_DESTROYED_SPRITE,
  BASE_SPRITE,
  ENEMY_TANK_SPRITES,
  PLAYER_TANK_SPRITES,
  POWERUP_SPRITES,
  FONT_GLYPHS,
  FONT_GLYPH_HEIGHT,
  FONT_GLYPH_WIDTH,
} from '@/games/tank-battle/data/sprites.ts'
import { MAX_PLAYER_STAR } from '@/games/tank-battle/data/tankSpecs.ts'
import type { Base } from '@/games/tank-battle/entity/Base.ts'
import type { Bullet } from '@/games/tank-battle/entity/Bullet.ts'
import type { Explosion } from '@/games/tank-battle/entity/Explosion.ts'
import type { PowerUp } from '@/games/tank-battle/entity/PowerUp.ts'
import type { Tank } from '@/games/tank-battle/entity/Tank.ts'
import { EnemyKind, TankSide, TerrainKind } from '@/games/tank-battle/types.ts'
import { COLORS, POWERUP_PALETTE } from '@/games/tank-battle/render/palette.ts'

/** 坦克精灵的字符 → 颜色映射 */
interface TankPalette {
  readonly body: string
  readonly tread: string
  readonly highlight: string
}

/**
 * 按字符矩阵绘制精灵。
 * 字符 ' ' 为透明，其余字符查 palette 取色；未定义的字符跳过。
 */
function drawMatrix(
  context: CanvasRenderingContext2D,
  matrix: readonly string[],
  originX: number,
  originY: number,
  palette: Readonly<Record<string, string>>,
): void {
  for (let row = 0; row < matrix.length; row += 1) {
    const line = matrix[row]
    for (let col = 0; col < line.length; col += 1) {
      const char = line[col]
      const color = palette[char]
      if (color === undefined) {
        continue
      }
      context.fillStyle = color
      context.fillRect(originX + col, originY + row, 1, 1)
    }
  }
}

/** 取坦克配色 */
function getTankPalette(tank: Tank): TankPalette {
  if (tank.side === TankSide.PLAYER) {
    const maxed = tank.star >= MAX_PLAYER_STAR
    if (tank.playerSlot === 1)
      return { body: maxed ? '#b3efff' : '#4cb9e7', tread: '#24617d', highlight: '#e0f8ff' }
    return {
      body: maxed ? COLORS.PLAYER_BODY_MAX : COLORS.PLAYER_BODY,
      tread: COLORS.PLAYER_TREAD,
      highlight: maxed ? COLORS.PLAYER_HIGHLIGHT_MAX : COLORS.PLAYER_HIGHLIGHT,
    }
  }

  if (tank.bonusCarrier && tank.bonusFlashTicks < 16) {
    return { body: '#f83800', tread: '#a81000', highlight: '#ffb8b0' }
  }
  switch (tank.enemyKind) {
    case EnemyKind.FAST:
      return {
        body: COLORS.ENEMY_FAST_BODY,
        tread: COLORS.ENEMY_FAST_TREAD,
        highlight: COLORS.ENEMY_FAST_HIGHLIGHT,
      }
    case EnemyKind.POWER:
      return {
        body: COLORS.ENEMY_POWER_BODY,
        tread: COLORS.ENEMY_POWER_TREAD,
        highlight: COLORS.ENEMY_POWER_HIGHLIGHT,
      }
    case EnemyKind.ARMOR: {
      // 重甲坦克按剩余装甲变色，直观反映还需几发
      const tier = Math.min(Math.max(tank.armor - 1, 0), COLORS.ENEMY_ARMOR_BODY.length - 1)
      return {
        body: COLORS.ENEMY_ARMOR_BODY[tier],
        tread: COLORS.ENEMY_ARMOR_TREAD,
        highlight: COLORS.ENEMY_ARMOR_HIGHLIGHT,
      }
    }
    default:
      return {
        body: COLORS.ENEMY_BASIC_BODY,
        tread: COLORS.ENEMY_BASIC_TREAD,
        highlight: COLORS.ENEMY_BASIC_HIGHLIGHT,
      }
  }
}

/** 绘制单辆坦克，含出生闪烁与护盾 */
export function drawTank(context: CanvasRenderingContext2D, tank: Tank): void {
  if (!tank.alive) {
    return
  }

  // 出生保护期用星形闪烁替代坦克本体
  if (tank.isSpawning()) {
    drawSpawnBlink(context, tank)
    return
  }

  const palette = getTankPalette(tank)
  const sprites =
    tank.side === TankSide.PLAYER
      ? PLAYER_TANK_SPRITES[Math.min(MAX_PLAYER_STAR, Math.max(0, tank.star))]
      : ENEMY_TANK_SPRITES[tank.enemyKind ?? EnemyKind.BASIC]
  drawMatrix(context, sprites[tank.direction], Math.round(tank.x), Math.round(tank.y), {
    '1': tank.hitFlashTicks > 0 ? COLORS.EXPLOSION_CORE : palette.body,
    '2': palette.tread,
    '3': tank.hitFlashTicks > 0 ? COLORS.EXPLOSION_MID : palette.highlight,
  })

  drawTankDetails(context, tank, palette.highlight)
  if (tank.shieldTicks > 0) {
    drawShield(context, tank)
  }
}

/** 在朝上坐标系内绘制细节，然后跟随车身旋转，四个方向保持像素对齐。 */
function drawTankDetails(context: CanvasRenderingContext2D, tank: Tank, highlight: string): void {
  const pixel = (x: number, y: number): void => {
    for (let turn = 0; turn < tank.direction; turn += 1) {
      const previousX = x
      x = TANK_SIZE - 1 - y
      y = previousX
    }
    context.fillRect(Math.round(tank.x + x), Math.round(tank.y + y), 1, 1)
  }
  context.fillStyle = highlight
  const phase = Math.floor(tank.treadPhase / 2)
  for (const x of [1, 3, 12, 14]) {
    for (let y = 3 + phase; y < 14; y += 4) pixel(x, y)
  }
  if (tank.muzzleFlashTicks > 0) {
    context.fillStyle = COLORS.EXPLOSION_MID
    for (let x = 5; x <= 10; x += 1) pixel(x, -2)
    context.fillStyle = COLORS.EXPLOSION_CORE
    for (let y = -3; y <= 0; y += 1) {
      pixel(7, y)
      pixel(8, y)
    }
  }
  if (tank.maxArmor > 1) {
    context.fillStyle = tank.hitFlashTicks > 0 ? COLORS.EXPLOSION_CORE : highlight
    for (let index = 0; index < tank.armor; index += 1) pixel(5 + index * 2, 11)
  }
}

/** 生成点的旋转星形闪烁 */
function drawSpawnBlink(context: CanvasRenderingContext2D, tank: Tank): void {
  const phase = Math.floor(tank.spawnBlinkTicks / 4) % 2
  const centerX = tank.x + TANK_SIZE / 2
  const centerY = tank.y + TANK_SIZE / 2
  const radius = 2 + (tank.spawnBlinkTicks % 12)

  context.fillStyle = phase === 0 ? COLORS.SHIELD_INNER : COLORS.SHIELD_OUTER
  // 十字 + 对角，构成简易星形
  context.fillRect(centerX - radius, centerY - 1, radius * 2, 2)
  context.fillRect(centerX - 1, centerY - radius, 2, radius * 2)
}

/** 护盾：坦克外围一圈闪烁边框 */
function drawShield(context: CanvasRenderingContext2D, tank: Tank): void {
  const flicker = Math.floor(tank.shieldTicks / 4) % 2 === 0
  context.strokeStyle = flicker ? COLORS.SHIELD_OUTER : COLORS.SHIELD_INNER
  context.lineWidth = 1
  // +0.5 对齐到像素中心，避免 1px 描边被平摊成 2px
  context.strokeRect(tank.x + 0.5, tank.y + 0.5, TANK_SIZE - 1, TANK_SIZE - 1)
}

/** 绘制子弹 */
export function drawBullet(context: CanvasRenderingContext2D, bullet: Bullet): void {
  if (!bullet.alive) {
    return
  }
  context.fillStyle = COLORS.BULLET
  context.fillRect(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE)
}

/** 绘制一格地形。tree 层由 drawTreeCell 单独在坦克之后绘制。 */
export function drawTerrainCell(
  context: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  kind: TerrainKind,
  brickMask: number,
  animationPhase: number,
): void {
  const originX = cellX * CELL_SIZE
  const originY = cellY * CELL_SIZE

  switch (kind) {
    case TerrainKind.BRICK:
      drawBrickCell(context, originX, originY, brickMask)
      break

    case TerrainKind.STEEL:
      drawSteelCell(context, originX, originY, brickMask)
      break

    case TerrainKind.WATER:
      drawWaterCell(context, originX, originY, animationPhase)
      break

    case TerrainKind.ICE:
      drawIceCell(context, originX, originY)
      break

    default:
      break
  }
}

/** 草地需要覆盖在坦克之上，因此单独提供绘制入口 */
export function drawTreeCell(
  context: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
): void {
  const originX = cellX * CELL_SIZE
  const originY = cellY * CELL_SIZE

  context.fillStyle = COLORS.TREE_MAIN
  context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE)

  // 叶片的明暗与黑色缝隙形成簇状纹理。
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const leaf = (x + y * 2) % 8
      context.fillStyle =
        leaf < 2 ? COLORS.TREE_LIGHT : (x * 3 + y) % 7 === 0 ? '#000000' : COLORS.TREE_MAIN
      context.fillRect(originX + x, originY + y, 1, 1)
    }
  }
}

/** 8×4 错缝砖纹；破坏仍由 4×4 子块掩码决定。 */
function drawBrickCell(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  brickMask: number,
): void {
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const bit = Math.floor(y / BRICK_SUB_SIZE) * BRICK_SUB + Math.floor(x / BRICK_SUB_SIZE)
      if ((brickMask & (1 << bit)) === 0) continue
      const seam = (x + (Math.floor(y / 4) % 2) * 4) % 8
      context.fillStyle =
        y % 4 === 3 || seam === 7
          ? COLORS.BRICK_DARK
          : y % 4 === 0
            ? COLORS.BRICK_LIGHT
            : COLORS.BRICK_MAIN
      context.fillRect(originX + x, originY + y, 1, 1)
    }
  }
}

/** 钢墙：2x2 分块，每块带高光与暗角 */
function drawSteelCell(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  mask: number,
): void {
  const half = CELL_SIZE / 2
  for (let blockY = 0; blockY < 2; blockY += 1) {
    for (let blockX = 0; blockX < 2; blockX += 1) {
      if ((mask & (1 << (blockY * 8 + blockX * 2))) === 0) continue
      const x = originX + blockX * half
      const y = originY + blockY * half
      context.fillStyle = COLORS.STEEL_MAIN
      context.fillRect(x, y, half, half)
      context.fillStyle = COLORS.STEEL_LIGHT
      context.fillRect(x + 1, y + 1, half - 3, 2)
      context.fillRect(x + 1, y + 1, 2, half - 3)
      context.fillStyle = COLORS.STEEL_DARK
      context.fillRect(x, y + half - 1, half, 1)
      context.fillRect(x + half - 1, y, 1, half)
    }
  }
}

/** 水面：横向波纹随相位左右移动 */
function drawWaterCell(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  animationPhase: number,
): void {
  context.fillStyle = COLORS.WATER_MAIN
  context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE)

  context.fillStyle = COLORS.WATER_LIGHT
  const shift = animationPhase % 4
  for (let y = 2; y < CELL_SIZE; y += 6) {
    context.fillRect(originX + shift, originY + y, 6, 1)
    context.fillRect(originX + ((shift + 8) % CELL_SIZE), originY + y + 3, 4, 1)
  }
}

/** 冰面：浅蓝底 + 对角高光 */
function drawIceCell(context: CanvasRenderingContext2D, originX: number, originY: number): void {
  context.fillStyle = COLORS.ICE_MAIN
  context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE)

  context.fillStyle = COLORS.ICE_LIGHT
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      if ((x + y) % 4 < 2) context.fillRect(originX + x, originY + y, 1, 1)
    }
  }
}

/** 绘制老鹰基地 */
export function drawBase(context: CanvasRenderingContext2D, base: Base): void {
  const originX = base.cellX * CELL_SIZE
  const originY = base.cellY * CELL_SIZE
  const sprite = base.destroyed ? BASE_DESTROYED_SPRITE : BASE_SPRITE
  const color = base.destroyed ? COLORS.BASE_DESTROYED : COLORS.BASE_EAGLE
  drawMatrix(context, sprite, originX, originY, {
    '1': color,
    '2': COLORS.STEEL_DARK,
    '3': COLORS.STEEL_LIGHT,
  })
}

/** 共用完整精灵包含蓝底、内外边框与图标明暗；闪烁时整块隐藏。 */
export function drawPowerUp(context: CanvasRenderingContext2D, powerUp: PowerUp): void {
  if (!powerUp.alive || !powerUp.isVisible()) return
  drawMatrix(
    context,
    POWERUP_SPRITES[powerUp.kind],
    powerUp.cellX * CELL_SIZE,
    powerUp.cellY * CELL_SIZE,
    POWERUP_PALETTE,
  )
}

/** 绘制爆炸：三层同心方块随进度先扩张后收缩 */
export function drawExplosion(context: CanvasRenderingContext2D, explosion: Explosion): void {
  if (!explosion.alive) {
    return
  }

  const progress = explosion.getProgress()
  const maxRadius = explosion.big ? 14 : 7
  // 先扩张到峰值再收缩，用 sin 曲线一次表达
  const radius = Math.max(1, Math.round(maxRadius * Math.sin(progress * Math.PI)))

  const layers: readonly (readonly [string, number])[] = [
    [COLORS.EXPLOSION_OUTER, radius],
    [COLORS.EXPLOSION_MID, Math.round(radius * 0.66)],
    [COLORS.EXPLOSION_CORE, Math.round(radius * 0.33)],
  ]

  for (const [color, layerRadius] of layers) {
    if (layerRadius <= 0) {
      continue
    }
    context.fillStyle = color
    context.fillRect(
      Math.round(explosion.centerX - layerRadius),
      Math.round(explosion.centerY - layerRadius),
      layerRadius * 2,
      layerRadius * 2,
    )
  }
}

/**
 * 绘制像素文本。
 *
 * 使用内置 3x5 字模而非 Canvas 原生文本 —— 原生字体在整数倍放大下会
 * 出现抗锯齿灰边，与像素风格冲突。
 */
export function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  originX: number,
  originY: number,
  color: string,
  scale = 1,
): void {
  const upper = text.toUpperCase()
  const glyphAdvance = (FONT_GLYPH_WIDTH + 1) * scale

  context.fillStyle = color
  for (let index = 0; index < upper.length; index += 1) {
    const glyph = FONT_GLYPHS[upper[index]]
    if (glyph === undefined) {
      continue
    }
    const glyphX = originX + index * glyphAdvance
    for (let row = 0; row < FONT_GLYPH_HEIGHT; row += 1) {
      const line = glyph[row]
      for (let col = 0; col < FONT_GLYPH_WIDTH; col += 1) {
        if (line[col] !== '1') {
          continue
        }
        context.fillRect(glyphX + col * scale, originY + row * scale, scale, scale)
      }
    }
  }
}

/** 计算像素文本的渲染宽度，用于居中排版 */
export function measureText(text: string, scale = 1): number {
  if (text.length === 0) {
    return 0
  }
  return text.length * (FONT_GLYPH_WIDTH + 1) * scale - scale
}
