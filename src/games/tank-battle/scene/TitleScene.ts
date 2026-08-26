import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants.ts';
import { TANK_SPRITES } from '../data/sprites.ts';
import { drawText, measureText } from '../render/drawSprites.ts';
import { COLORS } from '../render/palette.ts';
import { Direction, type InputSnapshot } from '../types.ts';
import type { Scene } from './Scene.ts';

interface TitleSceneCallbacks {
  readonly onStart: () => void;
}

/** 标题画面：显示游戏名、操作说明与最高分，按确认键开始。 */
export class TitleScene implements Scene {
  private readonly callbacks: TitleSceneCallbacks;
  private readonly getHighScore: () => number;
  private blinkPhase = 0;

  constructor(callbacks: TitleSceneCallbacks, getHighScore: () => number) {
    this.callbacks = callbacks;
    this.getHighScore = getHighScore;
  }

  onEnter(): void {
    this.blinkPhase = 0;
  }

  update(input: InputSnapshot): void {
    this.blinkPhase = (this.blinkPhase + 1) % 60;
    if (input.confirmEdge) {
      this.callbacks.onStart();
    }
  }

  render(context: CanvasRenderingContext2D): void {
    context.fillStyle = COLORS.FIELD_BACKGROUND;
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawCentered(context, 'BATTLE CITY', 24, COLORS.TEXT_HIGHLIGHT, 2);
    drawCentered(context, 'TANK BATTLE', 44, COLORS.TEXT_PRIMARY, 1);

    drawTankEmblem(context, CANVAS_WIDTH / 2 - 8, 60);

    drawCentered(context, 'ARROWS OR WASD MOVE', 90, COLORS.TEXT_PRIMARY, 1);
    drawCentered(context, 'SPACE OR J FIRE', 100, COLORS.TEXT_PRIMARY, 1);
    drawCentered(context, 'P PAUSE', 110, COLORS.TEXT_PRIMARY, 1);

    drawCentered(
      context,
      `HI SCORE ${String(this.getHighScore()).padStart(6, '0')}`,
      132,
      COLORS.TEXT_HIGHLIGHT,
      1,
    );

    // 闪烁的开始提示
    if (this.blinkPhase < 40) {
      drawCentered(context, 'PRESS SPACE TO START', 160, COLORS.TEXT_PRIMARY, 1);
    }

    drawCentered(context, 'PROTECT THE EAGLE', 184, COLORS.BASE_EAGLE, 1);
  }
}

/** 在画布水平居中绘制一行文本 */
function drawCentered(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  color: string,
  scale: number,
): void {
  const width = measureText(text, scale);
  drawText(context, text, Math.round((CANVAS_WIDTH - width) / 2), y, color, scale);
}

/** 标题下方的玩家坦克图标 */
function drawTankEmblem(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
): void {
  const sprite = TANK_SPRITES[Direction.UP];
  const palette: Readonly<Record<string, string>> = {
    '1': COLORS.PLAYER_BODY,
    '2': COLORS.PLAYER_TREAD,
    '3': COLORS.PLAYER_HIGHLIGHT,
  };

  for (let row = 0; row < sprite.length; row += 1) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col += 1) {
      const color = palette[line[col]];
      if (color === undefined) {
        continue;
      }
      context.fillStyle = color;
      context.fillRect(originX + col, originY + row, 1, 1);
    }
  }
}
