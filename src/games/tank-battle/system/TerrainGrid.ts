import {
  BRICK_SUB,
  BRICK_SUB_SIZE,
  CELL_SIZE,
  FIELD_PIXELS,
  GRID_SIZE,
} from '@/games/tank-battle/constants.ts'
import { BASE_WALL_CELLS, BASE_WALL_MASKS } from '@/games/tank-battle/data/levels.ts'
import {
  Direction,
  TerrainKind,
  type Rect,
  type TerrainHitResult,
} from '@/games/tank-battle/types.ts'

/** 一格砖墙全部子块存活时的掩码（16 位全 1） */
const FULL_BRICK_MASK = (1 << (BRICK_SUB * BRICK_SUB)) - 1

/** 地形字符 → 枚举 */
const CHAR_TO_KIND: Readonly<Record<string, TerrainKind>> = {
  '.': TerrainKind.EMPTY,
  '#': TerrainKind.BRICK,
  '@': TerrainKind.STEEL,
  '~': TerrainKind.WATER,
  '*': TerrainKind.TREE,
  '%': TerrainKind.ICE,
  '>': TerrainKind.BRICK,
  v: TerrainKind.BRICK,
  '<': TerrainKind.BRICK,
  '^': TerrainKind.BRICK,
  r: TerrainKind.STEEL,
  b: TerrainKind.STEEL,
  l: TerrainKind.STEEL,
  t: TerrainKind.STEEL,
}

const PARTIAL_MASKS: Readonly<Record<string, number>> = {
  '>': 0xcccc,
  v: 0xff00,
  '<': 0x3333,
  '^': 0x00ff,
  r: 0xcccc,
  b: 0xff00,
  l: 0x3333,
  t: 0x00ff,
}

/**
 * 13x13 地形网格。
 *
 * 砖墙以 1/4 格（4x4 = 16 个子块）粒度破坏：每格用一个 16 位掩码记录
 * 子块存活情况，掩码归零时该格退化为空地。这是复刻原作「砖墙局部破损」
 * 而非「整块消失」表现的必要设计。
 *
 * 所有碰撞查询以逻辑像素矩形为入参，内部换算到格与子块。
 */
export class TerrainGrid {
  private readonly kinds: TerrainKind[] = []
  private readonly wallMasks: number[] = []

  /** 铲子道具生效期间，基地围墙被临时替换为钢墙，此标记用于避免重复保存/还原 */
  private shovelActive = false

  constructor(terrain: readonly string[]) {
    this.load(terrain)
  }

  /** 载入关卡地形，重置全部状态 */
  load(terrain: readonly string[]): void {
    this.kinds.length = 0
    this.wallMasks.length = 0
    this.shovelActive = false

    for (let row = 0; row < GRID_SIZE; row += 1) {
      const line = terrain[row] ?? ''
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const kind = CHAR_TO_KIND[line[col] ?? '.'] ?? TerrainKind.EMPTY
        this.kinds.push(kind)
        this.wallMasks.push(
          kind === TerrainKind.BRICK || kind === TerrainKind.STEEL
            ? (PARTIAL_MASKS[line[col]] ?? FULL_BRICK_MASK)
            : 0,
        )
      }
    }

    // 基地围墙由数据统一铺设，不依赖关卡矩阵是否写对
    this.setBaseWalls(TerrainKind.BRICK)
  }

  private index(cellX: number, cellY: number): number {
    return cellY * GRID_SIZE + cellX
  }

  private inBounds(cellX: number, cellY: number): boolean {
    return cellX >= 0 && cellX < GRID_SIZE && cellY >= 0 && cellY < GRID_SIZE
  }

  getKind(cellX: number, cellY: number): TerrainKind {
    if (!this.inBounds(cellX, cellY)) {
      return TerrainKind.STEEL // 越界视为钢墙，天然形成战场边界
    }
    return this.kinds[this.index(cellX, cellY)]
  }

  getWallMask(cellX: number, cellY: number): number {
    if (!this.inBounds(cellX, cellY)) {
      return 0
    }
    return this.wallMasks[this.index(cellX, cellY)]
  }

  private setCell(cellX: number, cellY: number, kind: TerrainKind): void {
    if (!this.inBounds(cellX, cellY)) {
      return
    }
    const idx = this.index(cellX, cellY)
    this.kinds[idx] = kind
    this.wallMasks[idx] =
      kind === TerrainKind.BRICK || kind === TerrainKind.STEEL ? FULL_BRICK_MASK : 0
  }

  /** 该地形是否阻挡坦克移动 */
  private kindBlocksTank(kind: TerrainKind): boolean {
    return kind === TerrainKind.BRICK || kind === TerrainKind.STEEL || kind === TerrainKind.WATER
  }

  /** 该地形是否阻挡子弹（水面不挡子弹是原作规则） */
  private kindBlocksBullet(kind: TerrainKind): boolean {
    return kind === TerrainKind.BRICK || kind === TerrainKind.STEEL
  }

  /**
   * 给定像素矩形是否与阻挡坦克的地形重叠。
   * 砖墙需精确到子块：已被打空的部分可以通行。
   */
  blocksTank(rect: Rect): boolean {
    // 战场边界
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > FIELD_PIXELS ||
      rect.y + rect.height > FIELD_PIXELS
    ) {
      return true
    }

    const minCellX = Math.floor(rect.x / CELL_SIZE)
    const maxCellX = Math.floor((rect.x + rect.width - 1) / CELL_SIZE)
    const minCellY = Math.floor(rect.y / CELL_SIZE)
    const maxCellY = Math.floor((rect.y + rect.height - 1) / CELL_SIZE)

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const kind = this.getKind(cellX, cellY)
        if (!this.kindBlocksTank(kind)) {
          continue
        }
        if (kind === TerrainKind.WATER) {
          return true
        }
        if (this.brickSubBlocks(cellX, cellY, rect)) {
          return true
        }
      }
    }
    return false
  }

  /** 砖墙格内是否有存活子块与矩形重叠 */
  private brickSubBlocks(cellX: number, cellY: number, rect: Rect): boolean {
    const mask = this.getWallMask(cellX, cellY)
    if (mask === 0) {
      return false
    }

    const cellOriginX = cellX * CELL_SIZE
    const cellOriginY = cellY * CELL_SIZE

    for (let subY = 0; subY < BRICK_SUB; subY += 1) {
      for (let subX = 0; subX < BRICK_SUB; subX += 1) {
        if ((mask & (1 << (subY * BRICK_SUB + subX))) === 0) {
          continue
        }
        const subLeft = cellOriginX + subX * BRICK_SUB_SIZE
        const subTop = cellOriginY + subY * BRICK_SUB_SIZE
        const overlaps =
          rect.x < subLeft + BRICK_SUB_SIZE &&
          rect.x + rect.width > subLeft &&
          rect.y < subTop + BRICK_SUB_SIZE &&
          rect.y + rect.height > subTop
        if (overlaps) {
          return true
        }
      }
    }
    return false
  }

  /**
   * 子弹命中判定与破坏结算。
   *
   * @param rect 子弹当前像素矩形
   * @param power 子弹威力，>= 2 可击穿钢墙
   */
  hitByBullet(rect: Rect, power: number, direction: Direction = Direction.UP): TerrainHitResult {
    // 越界即命中边界，但不破坏任何东西
    if (
      rect.x < 0 ||
      rect.y < 0 ||
      rect.x + rect.width > FIELD_PIXELS ||
      rect.y + rect.height > FIELD_PIXELS
    ) {
      return { hit: true, destroyed: false }
    }

    const minCellX = Math.floor(rect.x / CELL_SIZE)
    const maxCellX = Math.floor((rect.x + rect.width - 1) / CELL_SIZE)
    const minCellY = Math.floor(rect.y / CELL_SIZE)
    const maxCellY = Math.floor((rect.y + rect.height - 1) / CELL_SIZE)

    let hit = false
    for (let y = minCellY; y <= maxCellY; y += 1) {
      for (let x = minCellX; x <= maxCellX; x += 1) {
        if (this.kindBlocksBullet(this.getKind(x, y)) && this.brickSubBlocks(x, y, rect)) hit = true
      }
    }
    if (!hit) return { hit: false, destroyed: false }

    // A hit removes a tank-width strip, so repeated shots open a traversable passage.
    // Brick depth is 4px; upgraded shells and steel quadrants use 8px.
    const vertical = direction === Direction.UP || direction === Direction.DOWN
    let destroyed = false
    for (const kind of [TerrainKind.BRICK, TerrainKind.STEEL]) {
      if (kind === TerrainKind.STEEL && power < 2) continue
      const depth = kind === TerrainKind.STEEL || power >= 2 ? 8 : 4
      const impact =
        direction === Direction.UP
          ? rect.y
          : direction === Direction.DOWN
            ? rect.y + rect.height - 1
            : direction === Direction.LEFT
              ? rect.x
              : rect.x + rect.width - 1
      const damage: Rect = vertical
        ? {
            x: Math.floor((rect.x + rect.width / 2 - 8) / 8) * 8,
            y: Math.floor(impact / depth) * depth,
            width: 16,
            height: depth,
          }
        : {
            x: Math.floor(impact / depth) * depth,
            y: Math.floor((rect.y + rect.height / 2 - 8) / 8) * 8,
            width: depth,
            height: 16,
          }
      for (
        let y = Math.max(0, Math.floor(damage.y / CELL_SIZE));
        y <= Math.min(GRID_SIZE - 1, Math.floor((damage.y + damage.height - 1) / CELL_SIZE));
        y += 1
      ) {
        for (
          let x = Math.max(0, Math.floor(damage.x / CELL_SIZE));
          x <= Math.min(GRID_SIZE - 1, Math.floor((damage.x + damage.width - 1) / CELL_SIZE));
          x += 1
        ) {
          if (this.getKind(x, y) === kind)
            destroyed = this.clearBrickSubBlocks(x, y, damage) || destroyed
        }
      }
    }
    return { hit, destroyed }
  }

  /** Read-only ray probe respects empty halves of steel blocks. */
  isSteelAt(x: number, y: number): boolean {
    const cellX = Math.floor(x / CELL_SIZE)
    const cellY = Math.floor(y / CELL_SIZE)
    return (
      this.getKind(cellX, cellY) === TerrainKind.STEEL &&
      this.brickSubBlocks(cellX, cellY, { x, y, width: 0.01, height: 0.01 })
    )
  }

  /** 清除砖墙格内与矩形重叠的子块。返回是否有子块被清除。 */
  private clearBrickSubBlocks(cellX: number, cellY: number, rect: Rect): boolean {
    const idx = this.index(cellX, cellY)
    let mask = this.wallMasks[idx]
    const original = mask

    const cellOriginX = cellX * CELL_SIZE
    const cellOriginY = cellY * CELL_SIZE

    for (let subY = 0; subY < BRICK_SUB; subY += 1) {
      for (let subX = 0; subX < BRICK_SUB; subX += 1) {
        const bit = 1 << (subY * BRICK_SUB + subX)
        if ((mask & bit) === 0) {
          continue
        }
        const subLeft = cellOriginX + subX * BRICK_SUB_SIZE
        const subTop = cellOriginY + subY * BRICK_SUB_SIZE
        const overlaps =
          rect.x < subLeft + BRICK_SUB_SIZE &&
          rect.x + rect.width > subLeft &&
          rect.y < subTop + BRICK_SUB_SIZE &&
          rect.y + rect.height > subTop
        if (overlaps) {
          mask &= ~bit
        }
      }
    }

    this.wallMasks[idx] = mask
    if (mask === 0) {
      this.kinds[idx] = TerrainKind.EMPTY
    }
    return mask !== original
  }

  /** 指定像素点所在格是否为冰面 */
  isIceAt(pixelX: number, pixelY: number): boolean {
    const cellX = Math.floor(pixelX / CELL_SIZE)
    const cellY = Math.floor(pixelY / CELL_SIZE)
    return this.getKind(cellX, cellY) === TerrainKind.ICE
  }

  /** 该格是否为空地（可用于生成道具 / 敌方坦克） */
  isCellFree(cellX: number, cellY: number): boolean {
    const kind = this.getKind(cellX, cellY)
    return kind === TerrainKind.EMPTY || kind === TerrainKind.TREE || kind === TerrainKind.ICE
  }

  /** 铲子道具生效：基地围墙临时变钢墙 */
  applyShovel(): void {
    this.shovelActive = true
    this.setBaseWalls(TerrainKind.STEEL)
  }

  /**
   * 铲子道具失效：围墙还原为完整砖墙。
   * 刻意不还原道具生效前已被打掉的部分 —— 原作也是重建完整围墙。
   */
  revertShovel(): void {
    if (!this.shovelActive) {
      return
    }
    this.shovelActive = false
    this.setBaseWalls(TerrainKind.BRICK)
  }

  /** The original spawn handler clears the block beneath a new tank ($E3B2). */
  clearSpawnCell(cellX: number, cellY: number): void {
    this.setCell(cellX, cellY, TerrainKind.EMPTY)
  }

  private setBaseWalls(kind: TerrainKind): void {
    BASE_WALL_CELLS.forEach(([x, y], index) => {
      this.setCell(x, y, kind)
      this.wallMasks[this.index(x, y)] = BASE_WALL_MASKS[index]
    })
  }

  /** 遍历所有格，供渲染层使用 */
  forEachCell(
    visit: (cellX: number, cellY: number, kind: TerrainKind, brickMask: number) => void,
  ): void {
    for (let cellY = 0; cellY < GRID_SIZE; cellY += 1) {
      for (let cellX = 0; cellX < GRID_SIZE; cellX += 1) {
        const idx = this.index(cellX, cellY)
        visit(cellX, cellY, this.kinds[idx], this.wallMasks[idx])
      }
    }
  }
}
