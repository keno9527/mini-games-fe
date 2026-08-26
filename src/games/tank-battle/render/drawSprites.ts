import {
  BRICK_SUB,
  BRICK_SUB_SIZE,
  BULLET_SIZE,
  CELL_SIZE,
  TANK_SIZE,
} from '../constants.ts';
import {
  BASE_DESTROYED_SPRITE,
  BASE_SPRITE,
  FONT_GLYPHS,
  FONT_GLYPH_HEIGHT,
  FONT_GLYPH_WIDTH,
  ICON_GRENADE,
  ICON_HELMET,
  ICON_SHOVEL,
  ICON_STAR,
  ICON_TANK,
  ICON_TIMER,
  POWERUP_ICON_SIZE,
  TANK_SPRITES,
} from '../data/sprites.ts';
import { MAX_PLAYER_STAR } from '../data/tankSpecs.ts';
import type { Base } from '../entity/Base.ts';
import type { Bullet } from '../entity/Bullet.ts';
import type { Explosion } from '../entity/Explosion.ts';
import type { PowerUp } from '../entity/PowerUp.ts';
import type { Tank } from '../entity/Tank.ts';
import { EnemyKind, PowerUpKind, TankSide, TerrainKind } from '../types.ts';
import { COLORS } from './palette.ts';

/** 坦克精灵的字符 → 颜色映射 */
interface TankPalette {
  readonly body: string;
  readonly tread: string;
  readonly highlight: string;
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
    const line = matrix[row];
    for (let col = 0; col < line.length; col += 1) {
      const char = line[col];
      const color = palette[char];
      if (color === undefined) {
        continue;
      }
      context.fillStyle = color;
      context.fillRect(originX + col, originY + row, 1, 1);
    }
  }
}

/** 取坦克配色 */
function getTankPalette(tank: Tank): TankPalette {
  if (tank.side === TankSide.PLAYER) {
    const maxed = tank.star >= MAX_PLAYER_STAR;
    return {
      body: maxed ? COLORS.PLAYER_BODY_MAX : COLORS.PLAYER_BODY,
      tread: COLORS.PLAYER_TREAD,
      highlight: maxed ? COLORS.PLAYER_HIGHLIGHT_MAX : COLORS.PLAYER_HIGHLIGHT,
    };
  }

  switch (tank.enemyKind) {
    case EnemyKind.FAST:
      return {
        body: COLORS.ENEMY_FAST_BODY,
        tread: COLORS.ENEMY_FAST_TREAD,
        highlight: COLORS.ENEMY_FAST_HIGHLIGHT,
      };
    case EnemyKind.POWER:
      return {
        body: COLORS.ENEMY_POWER_BODY,
        tread: COLORS.ENEMY_POWER_TREAD,
        highlight: COLORS.ENEMY_POWER_HIGHLIGHT,
      };
    case EnemyKind.ARMOR: {
      // 重甲坦克按剩余装甲变色，直观反映还需几发
      const tier = Math.min(
        Math.max(tank.armor - 1, 0),
        COLORS.ENEMY_ARMOR_BODY.length - 1,
      );
      return {
        body: COLORS.ENEMY_ARMOR_BODY[tier],
        tread: COLORS.ENEMY_ARMOR_TREAD,
        highlight: COLORS.ENEMY_ARMOR_HIGHLIGHT,
      };
    }
    default:
      return {
        body: COLORS.ENEMY_BASIC_BODY,
        tread: COLORS.ENEMY_BASIC_TREAD,
        highlight: COLORS.ENEMY_BASIC_HIGHLIGHT,
      };
  }
}

/** 绘制单辆坦克，含出生闪烁与护盾 */
export function drawTank(context: CanvasRenderingContext2D, tank: Tank): void {
  if (!tank.alive) {
    return;
  }

  // 出生保护期用星形闪烁替代坦克本体
  if (tank.isSpawning()) {
    drawSpawnBlink(context, tank);
    return;
  }

  const palette = getTankPalette(tank);
  drawMatrix(context, TANK_SPRITES[tank.direction], tank.x, tank.y, {
    '1': palette.body,
    '2': palette.tread,
    '3': palette.highlight,
  });

  if (tank.shieldTicks > 0) {
    drawShield(context, tank);
  }
}

/** 生成点的旋转星形闪烁 */
function drawSpawnBlink(context: CanvasRenderingContext2D, tank: Tank): void {
  const phase = Math.floor(tank.spawnBlinkTicks / 4) % 2;
  const centerX = tank.x + TANK_SIZE / 2;
  const centerY = tank.y + TANK_SIZE / 2;
  const radius = 2 + (tank.spawnBlinkTicks % 12);

  context.fillStyle = phase === 0 ? COLORS.SHIELD_INNER : COLORS.SHIELD_OUTER;
  // 十字 + 对角，构成简易星形
  context.fillRect(centerX - radius, centerY - 1, radius * 2, 2);
  context.fillRect(centerX - 1, centerY - radius, 2, radius * 2);
}

/** 护盾：坦克外围一圈闪烁边框 */
function drawShield(context: CanvasRenderingContext2D, tank: Tank): void {
  const flicker = Math.floor(tank.shieldTicks / 4) % 2 === 0;
  context.strokeStyle = flicker ? COLORS.SHIELD_OUTER : COLORS.SHIELD_INNER;
  context.lineWidth = 1;
  // +0.5 对齐到像素中心，避免 1px 描边被平摊成 2px
  context.strokeRect(tank.x + 0.5, tank.y + 0.5, TANK_SIZE - 1, TANK_SIZE - 1);
}

/** 绘制子弹 */
export function drawBullet(context: CanvasRenderingContext2D, bullet: Bullet): void {
  if (!bullet.alive) {
    return;
  }
  context.fillStyle = COLORS.BULLET;
  context.fillRect(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE);
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
  const originX = cellX * CELL_SIZE;
  const originY = cellY * CELL_SIZE;

  switch (kind) {
    case TerrainKind.BRICK:
      drawBrickCell(context, originX, originY, brickMask);
      break;

    case TerrainKind.STEEL:
      drawSteelCell(context, originX, originY);
      break;

    case TerrainKind.WATER:
      drawWaterCell(context, originX, originY, animationPhase);
      break;

    case TerrainKind.ICE:
      drawIceCell(context, originX, originY);
      break;

    default:
      break;
  }
}

/** 草地需要覆盖在坦克之上，因此单独提供绘制入口 */
export function drawTreeCell(
  context: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
): void {
  const originX = cellX * CELL_SIZE;
  const originY = cellY * CELL_SIZE;

  context.fillStyle = COLORS.TREE_MAIN;
  context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE);

  // 交错亮点模拟叶簇
  context.fillStyle = COLORS.TREE_LIGHT;
  for (let y = 0; y < CELL_SIZE; y += 4) {
    for (let x = 0; x < CELL_SIZE; x += 4) {
      const offset = ((x / 4 + y / 4) % 2) * 2;
      context.fillRect(originX + x + offset, originY + y, 2, 2);
    }
  }
}

/** 砖墙：按子块掩码逐块绘制，每块带亮/暗边模拟立体感 */
function drawBrickCell(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  brickMask: number,
): void {
  for (let subY = 0; subY < BRICK_SUB; subY += 1) {
    for (let subX = 0; subX < BRICK_SUB; subX += 1) {
      if ((brickMask & (1 << (subY * BRICK_SUB + subX))) === 0) {
        continue;
      }
      const x = originX + subX * BRICK_SUB_SIZE;
      const y = originY + subY * BRICK_SUB_SIZE;

      context.fillStyle = COLORS.BRICK_MAIN;
      context.fillRect(x, y, BRICK_SUB_SIZE, BRICK_SUB_SIZE);
      context.fillStyle = COLORS.BRICK_LIGHT;
      context.fillRect(x, y, BRICK_SUB_SIZE - 1, 1);
      context.fillStyle = COLORS.BRICK_DARK;
      context.fillRect(x, y + BRICK_SUB_SIZE - 1, BRICK_SUB_SIZE, 1);
    }
  }
}

/** 钢墙：2x2 分块，每块带高光与暗角 */
function drawSteelCell(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
): void {
  const half = CELL_SIZE / 2;
  for (let blockY = 0; blockY < 2; blockY += 1) {
    for (let blockX = 0; blockX < 2; blockX += 1) {
      const x = originX + blockX * half;
      const y = originY + blockY * half;
      context.fillStyle = COLORS.STEEL_MAIN;
      context.fillRect(x, y, half, half);
      context.fillStyle = COLORS.STEEL_LIGHT;
      context.fillRect(x, y, half - 1, 1);
      context.fillRect(x, y, 1, half - 1);
      context.fillStyle = COLORS.STEEL_DARK;
      context.fillRect(x, y + half - 1, half, 1);
      context.fillRect(x + half - 1, y, 1, half);
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
  context.fillStyle = COLORS.WATER_MAIN;
  context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE);

  context.fillStyle = COLORS.WATER_LIGHT;
  const shift = animationPhase % 4;
  for (let y = 2; y < CELL_SIZE; y += 6) {
    context.fillRect(originX + shift, originY + y, 6, 1);
    context.fillRect(originX + ((shift + 8) % CELL_SIZE), originY + y + 3, 4, 1);
  }
}

/** 冰面：浅蓝底 + 对角高光 */
function drawIceCell(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
): void {
  context.fillStyle = COLORS.ICE_MAIN;
  context.fillRect(originX, originY, CELL_SIZE, CELL_SIZE);

  context.fillStyle = COLORS.ICE_LIGHT;
  context.fillRect(originX + 2, originY + 2, 5, 1);
  context.fillRect(originX + 2, originY + 2, 1, 5);
  context.fillRect(originX + 9, originY + 9, 5, 1);
  context.fillRect(originX + 13, originY + 9, 1, 5);
}

/** 绘制老鹰基地 */
export function drawBase(context: CanvasRenderingContext2D, base: Base): void {
  const originX = base.cellX * CELL_SIZE;
  const originY = base.cellY * CELL_SIZE;
  const sprite = base.destroyed ? BASE_DESTROYED_SPRITE : BASE_SPRITE;
  const color = base.destroyed ? COLORS.BASE_DESTROYED : COLORS.BASE_EAGLE;
  drawMatrix(context, sprite, originX, originY, { '1': color });
}

/** 道具种类 → 图标矩阵 */
const POWERUP_ICONS: Readonly<Record<PowerUpKind, readonly string[]>> = {
  [PowerUpKind.GRENADE]: ICON_GRENADE,
  [PowerUpKind.HELMET]: ICON_HELMET,
  [PowerUpKind.SHOVEL]: ICON_SHOVEL,
  [PowerUpKind.STAR]: ICON_STAR,
  [PowerUpKind.TANK]: ICON_TANK,
  [PowerUpKind.TIMER]: ICON_TIMER,
};

/** 绘制道具：白框 + 居中图标，闪烁隐藏时跳过 */
export function drawPowerUp(context: CanvasRenderingContext2D, powerUp: PowerUp): void {
  if (!powerUp.alive || !powerUp.isVisible()) {
    return;
  }

  const originX = powerUp.cellX * CELL_SIZE;
  const originY = powerUp.cellY * CELL_SIZE;

  context.fillStyle = COLORS.POWERUP_FRAME;
  context.fillRect(originX + 1, originY + 1, CELL_SIZE - 2, CELL_SIZE - 2);

  const iconOffset = (CELL_SIZE - POWERUP_ICON_SIZE) / 2;
  const iconColor =
    powerUp.kind === PowerUpKind.STAR || powerUp.kind === PowerUpKind.TANK
      ? COLORS.POWERUP_ICON_ALT
      : COLORS.POWERUP_ICON;

  drawMatrix(
    context,
    POWERUP_ICONS[powerUp.kind],
    originX + iconOffset,
    originY + iconOffset,
    { '1': iconColor },
  );
}

/** 绘制爆炸：三层同心方块随进度先扩张后收缩 */
export function drawExplosion(
  context: CanvasRenderingContext2D,
  explosion: Explosion,
): void {
  if (!explosion.alive) {
    return;
  }

  const progress = explosion.getProgress();
  const maxRadius = explosion.big ? 14 : 7;
  // 先扩张到峰值再收缩，用 sin 曲线一次表达
  const radius = Math.max(1, Math.round(maxRadius * Math.sin(progress * Math.PI)));

  const layers: readonly (readonly [string, number])[] = [
    [COLORS.EXPLOSION_OUTER, radius],
    [COLORS.EXPLOSION_MID, Math.round(radius * 0.66)],
    [COLORS.EXPLOSION_CORE, Math.round(radius * 0.33)],
  ];

  for (const [color, layerRadius] of layers) {
    if (layerRadius <= 0) {
      continue;
    }
    context.fillStyle = color;
    context.fillRect(
      Math.round(explosion.centerX - layerRadius),
      Math.round(explosion.centerY - layerRadius),
      layerRadius * 2,
      layerRadius * 2,
    );
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
  const upper = text.toUpperCase();
  const glyphAdvance = (FONT_GLYPH_WIDTH + 1) * scale;

  context.fillStyle = color;
  for (let index = 0; index < upper.length; index += 1) {
    const glyph = FONT_GLYPHS[upper[index]];
    if (glyph === undefined) {
      continue;
    }
    const glyphX = originX + index * glyphAdvance;
    for (let row = 0; row < FONT_GLYPH_HEIGHT; row += 1) {
      const line = glyph[row];
      for (let col = 0; col < FONT_GLYPH_WIDTH; col += 1) {
        if (line[col] !== '1') {
          continue;
        }
        context.fillRect(glyphX + col * scale, originY + row * scale, scale, scale);
      }
    }
  }
}

/** 计算像素文本的渲染宽度，用于居中排版 */
export function measureText(text: string, scale = 1): number {
  if (text.length === 0) {
    return 0;
  }
  return text.length * (FONT_GLYPH_WIDTH + 1) * scale - scale;
}
