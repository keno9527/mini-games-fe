import { TerrainKind } from '../types.ts';
import type { World } from '../system/World.ts';
import {
  drawBase,
  drawBullet,
  drawExplosion,
  drawPowerUp,
  drawTank,
  drawTerrainCell,
  drawTreeCell,
} from './drawSprites.ts';
import { drawFieldBackground, drawHud } from './Hud.ts';

/**
 * 战场渲染器。
 *
 * 渲染顺序即层级关系，不可调换：
 *   底层地形 → 基地 → 道具 → 坦克 → 子弹 → 草地 → 爆炸 → HUD
 *
 * 草地刻意排在坦克之后 —— 原作中草地会遮蔽坦克，这是重要的战术要素。
 */
export function renderBattlefield(
  context: CanvasRenderingContext2D,
  world: World,
  animationPhase: number,
): void {
  drawFieldBackground(context);

  // 1. 底层地形（草地在此跳过）
  world.terrain.forEachCell((cellX, cellY, kind, brickMask) => {
    if (kind === TerrainKind.TREE) {
      return;
    }
    drawTerrainCell(context, cellX, cellY, kind, brickMask, animationPhase);
  });

  // 2. 基地
  drawBase(context, world.base);

  // 3. 道具（在坦克之下，被压过时仍可见边缘）
  for (const powerUp of world.powerUps) {
    drawPowerUp(context, powerUp);
  }

  // 4. 坦克
  for (const enemy of world.enemies) {
    drawTank(context, enemy);
  }
  if (world.player !== null) {
    drawTank(context, world.player);
  }

  // 5. 子弹
  for (const bullet of world.bullets) {
    drawBullet(context, bullet);
  }

  // 6. 草地：覆盖在坦克与子弹之上
  world.terrain.forEachCell((cellX, cellY, kind) => {
    if (kind === TerrainKind.TREE) {
      drawTreeCell(context, cellX, cellY);
    }
  });

  // 7. 爆炸：最顶层，草地也遮不住
  for (const explosion of world.explosions) {
    drawExplosion(context, explosion);
  }

  // 8. 信息栏
  drawHud(context, world);
}
