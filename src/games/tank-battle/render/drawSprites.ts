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
  PLAYER_TREAD_SPRITES,
  ENEMY_TREAD_SPRITES,
  BRICK_TILE,
  STEEL_TILE,
  TREE_TILE,
  WATER_TILE,
  ICE_TILE,
  SPAWN_SMALL,
  SPAWN_LARGE,
  EXPLOSION_FRAMES,
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
import { Direction, EnemyKind, TankSide, TerrainKind } from '@/games/tank-battle/types.ts'
import {
  COLORS,
  PLAYER_PALETTES,
  ARMOR_PALETTES,
  POWERUP_PALETTE,
  type TankPalette,
} from '@/games/tank-battle/render/palette.ts'

/**
 * 按字符矩阵绘制精灵。
 * 字符 ' ' 为透明，其余字符查 palette 取色；未定义的字符跳过。
 */
export function drawMatrix(
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
    return PLAYER_PALETTES[tank.playerSlot] ?? PLAYER_PALETTES[0]
  }
  if (tank.bonusCarrier && tank.bonusFlashTicks < 16) {
    return { body: '#d82800', tread: '#8c0074', highlight: '#fcfcfc' }
  }
  if (tank.enemyKind === EnemyKind.ARMOR) {
    const tier = Math.min(Math.max(tank.armor - 1, 0), ARMOR_PALETTES.length - 1)
    return ARMOR_PALETTES[tier]
  }
  return { body: COLORS.ENEMY_BODY, tread: COLORS.ENEMY_TREAD, highlight: COLORS.ENEMY_HIGHLIGHT }
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
  const treadFrame = Math.floor(tank.treadPhase / 2) % 2 === 1
  const players = treadFrame ? PLAYER_TREAD_SPRITES : PLAYER_TANK_SPRITES
  const enemies = treadFrame ? ENEMY_TREAD_SPRITES : ENEMY_TANK_SPRITES
  const sprites =
    tank.side === TankSide.PLAYER
      ? players[Math.min(MAX_PLAYER_STAR, Math.max(0, tank.star))]
      : enemies[tank.enemyKind ?? EnemyKind.BASIC]
  drawMatrix(context, sprites[tank.direction], Math.round(tank.x), Math.round(tank.y), {
    '1': tank.hitFlashTicks > 0 ? COLORS.EXPLOSION_CORE : palette.body,
    '2': palette.tread,
    '3': tank.hitFlashTicks > 0 ? COLORS.EXPLOSION_MID : palette.highlight,
  })

  if (tank.shieldTicks > 0) {
    drawShield(context, tank)
  }
}

/** 出生时由小十字扩展为四角星，再收回，使用固定像素帧。 */
function drawSpawnBlink(context: CanvasRenderingContext2D, tank: Tank): void {
  const sprite = Math.floor(tank.spawnBlinkTicks / 4) % 2 === 0 ? SPAWN_SMALL : SPAWN_LARGE
  const offset = (TANK_SIZE - sprite.length) / 2
  drawMatrix(context, sprite, Math.round(tank.x) + offset, Math.round(tank.y) + offset, {
    '1': COLORS.SHIELD_OUTER,
    '2': COLORS.SHIELD_INNER,
  })
}

/** 两帧断续白色护盾沿四边闪动，不使用现代蓝色描边。 */
function drawShield(context: CanvasRenderingContext2D, tank: Tank): void {
  const phase = Math.floor(tank.shieldTicks / 4) % 2
  const x = Math.round(tank.x)
  const y = Math.round(tank.y)
  context.fillStyle = COLORS.SHIELD_OUTER
  for (let pixel = 0; pixel < TANK_SIZE; pixel += 1) {
    if ((pixel + phase * 2) % 4 < 2) {
      context.fillRect(x + pixel, y, 1, 1)
      context.fillRect(x + TANK_SIZE - 1, y + pixel, 1, 1)
    } else {
      context.fillRect(x + pixel, y + TANK_SIZE - 1, 1, 1)
      context.fillRect(x, y + pixel, 1, 1)
    }
  }
}

/** 细长炮弹在原有碰撞框内绘制，视觉调整不改变命中范围。 */
export function drawBullet(context: CanvasRenderingContext2D, bullet: Bullet): void {
  if (!bullet.alive) return
  const vertical = bullet.direction === Direction.UP || bullet.direction === Direction.DOWN
  const inset = Math.floor((BULLET_SIZE - 2) / 2)
  context.fillStyle = COLORS.BULLET
  context.fillRect(
    Math.round(bullet.x) + (vertical ? inset : 0),
    Math.round(bullet.y) + (vertical ? 0 : inset),
    vertical ? 2 : BULLET_SIZE,
    vertical ? BULLET_SIZE : 2,
  )
}

const TERRAIN_ART: Partial<
  Record<
    TerrainKind,
    {
      tile: readonly string[]
      palette: Readonly<Record<string, string>>
    }
  >
> = {
  [TerrainKind.BRICK]: {
    tile: BRICK_TILE,
    palette: { '1': COLORS.BRICK_MAIN, '2': COLORS.BRICK_MORTAR, '3': COLORS.BRICK_DARK },
  },
  [TerrainKind.STEEL]: {
    tile: STEEL_TILE,
    palette: { '1': COLORS.STEEL_MAIN, '2': COLORS.STEEL_DARK, '3': COLORS.STEEL_LIGHT },
  },
  [TerrainKind.WATER]: {
    tile: WATER_TILE,
    palette: { '1': COLORS.WATER_MAIN, '3': COLORS.WATER_LIGHT },
  },
  [TerrainKind.ICE]: {
    tile: ICE_TILE,
    palette: { '1': COLORS.ICE_MAIN, '2': COLORS.ICE_DARK, '3': COLORS.ICE_LIGHT },
  },
  [TerrainKind.TREE]: {
    tile: TREE_TILE,
    palette: {
      '0': COLORS.FIELD_BACKGROUND,
      '1': COLORS.TREE_LIGHT,
      '2': COLORS.TREE_MAIN,
      '3': COLORS.TREE_DARK,
    },
  },
}

/** 8×8 图块铺满一格；砖墙和钢墙严格遵循同一 4×4 破坏掩码。 */
function drawTileCell(
  context: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  kind: TerrainKind,
  mask: number,
  animationPhase = 0,
): void {
  const art = TERRAIN_ART[kind]
  if (!art) return
  const wall = kind === TerrainKind.BRICK || kind === TerrainKind.STEEL
  const shift = kind === TerrainKind.WATER ? (animationPhase % 2) * 4 : 0
  for (let y = 0; y < CELL_SIZE; y += 1) {
    for (let x = 0; x < CELL_SIZE; x += 1) {
      const bit = Math.floor(y / BRICK_SUB_SIZE) * BRICK_SUB + Math.floor(x / BRICK_SUB_SIZE)
      if (wall && (mask & (1 << bit)) === 0) continue
      const row = art.tile[y % art.tile.length]
      context.fillStyle = art.palette[row[(x + shift) % row.length]]
      context.fillRect(cellX * CELL_SIZE + x, cellY * CELL_SIZE + y, 1, 1)
    }
  }
}

/** 地形底层；草地由 drawTreeCell 在坦克之后绘制。 */
export function drawTerrainCell(
  context: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  kind: TerrainKind,
  brickMask: number,
  animationPhase: number,
): void {
  if (kind !== TerrainKind.TREE) {
    drawTileCell(context, cellX, cellY, kind, brickMask, animationPhase)
  }
}

export function drawTreeCell(
  context: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
): void {
  drawTileCell(context, cellX, cellY, TerrainKind.TREE, 0xffff)
}

/** 绘制老鹰基地 */
export function drawBase(context: CanvasRenderingContext2D, base: Base): void {
  const originX = base.cellX * CELL_SIZE
  const originY = base.cellY * CELL_SIZE
  const sprite = base.destroyed ? BASE_DESTROYED_SPRITE : BASE_SPRITE
  const color = base.destroyed ? COLORS.BASE_DESTROYED : COLORS.BASE_EAGLE
  drawMatrix(context, sprite, originX, originY, {
    '1': color,
    '2': base.destroyed ? COLORS.FIELD_BACKGROUND : COLORS.BASE_DETAIL,
  })
}

/** 共用深蓝底、单像素白框与白色图标；闪烁时整块隐藏。 */
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

/** 放射状像素爆炸按生命进度切帧，小爆炸不会占用大爆炸的范围。 */
export function drawExplosion(context: CanvasRenderingContext2D, explosion: Explosion): void {
  if (!explosion.alive) return
  const sequence = explosion.big ? [0, 1, 2, 1] : [0, 1, 0]
  const phase = Math.min(sequence.length - 1, Math.floor(explosion.getProgress() * sequence.length))
  const sprite = EXPLOSION_FRAMES[sequence[phase]]
  drawMatrix(
    context,
    sprite,
    Math.round(explosion.centerX - sprite[0].length / 2),
    Math.round(explosion.centerY - sprite.length / 2),
    { '1': COLORS.EXPLOSION_CORE, '2': COLORS.EXPLOSION_MID, '3': COLORS.EXPLOSION_OUTER },
  )
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
