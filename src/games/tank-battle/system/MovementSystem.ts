import { CELL_SIZE, TANK_SIZE, TURN_SNAP } from '@/games/tank-battle/constants.ts'
import { clamp, rectsIntersect, snapTo } from '@/games/tank-battle/core/geometry.ts'
import { Direction, type Rect } from '@/games/tank-battle/types.ts'
import type { Tank } from '@/games/tank-battle/entity/Tank.ts'
import type { TerrainGrid } from '@/games/tank-battle/system/TerrainGrid.ts'

/** 方向 → 单位位移向量 */
const DIRECTION_VECTORS: readonly (readonly [number, number])[] = [
  [0, -1], // UP
  [1, 0], // RIGHT
  [0, 1], // DOWN
  [-1, 0], // LEFT
]

export function getDirectionVector(direction: Direction): readonly [number, number] {
  return DIRECTION_VECTORS[direction]
}

/** 方向是否为垂直方向 */
export function isVertical(direction: Direction): boolean {
  return direction === Direction.UP || direction === Direction.DOWN
}

export interface MoveContext {
  readonly terrain: TerrainGrid
  /** 除自身外所有需要避让的坦克 */
  readonly otherTanks: readonly Tank[]
  /** 基地矩形；被击毁后传 null */
  readonly baseRect: Rect | null
}

/**
 * 尝试让坦克朝指定方向移动。
 *
 * 转向时对非移动轴做半格吸附 —— 这是复刻原作手感的关键：坦克只能在半格
 * 网格上转向，因此能精确钻进半格宽的缝隙，而不会因为像素级偏移卡在墙角。
 *
 * @returns 是否实际发生了位移
 */
export function tryMoveTank(tank: Tank, direction: Direction, context: MoveContext): boolean {
  const candidate = getMoveCandidate(tank, direction)
  tank.direction = direction

  if (isBlocked(candidate, tank, context)) {
    tank.moving = false
    return false
  }

  tank.x = candidate.x
  tank.y = candidate.y
  tank.moving = true
  return true
}

/** AI 与实际移动共用同一探测，包含转向吸附且不改变实体状态。 */
export function canMoveTank(tank: Tank, direction: Direction, context: MoveContext): boolean {
  return !isBlocked(getMoveCandidate(tank, direction), tank, context)
}

function getMoveCandidate(tank: Tank, direction: Direction): Rect {
  // 每次尝试都对齐非移动轴，受阻转向后下一帧也不能绕过同一吸附检查。
  const x = isVertical(direction) ? snapTo(tank.x, TURN_SNAP) : tank.x
  const y = !isVertical(direction) ? snapTo(tank.y, TURN_SNAP) : tank.y
  const [dx, dy] = getDirectionVector(direction)
  const speed = tank.getSpec().moveSpeed
  return { x: x + dx * speed, y: y + dy * speed, width: TANK_SIZE, height: TANK_SIZE }
}

/** 候选位置是否被地形、其他坦克或基地阻挡 */
function isBlocked(candidate: Rect, self: Tank, context: MoveContext): boolean {
  if (context.terrain.blocksTank(candidate)) {
    return true
  }

  if (context.baseRect !== null && rectsIntersect(candidate, context.baseRect)) {
    return true
  }

  for (const other of context.otherTanks) {
    if (other.id === self.id || !other.alive) {
      continue
    }
    // 出生保护期的坦克不参与碰撞，避免生成点互相顶死
    if (other.isSpawning()) {
      continue
    }
    if (rectsIntersect(candidate, other.getRect())) {
      return true
    }
  }

  return false
}

/**
 * 更新冰面滑行状态。
 *
 * 站在冰面上松开方向键后，坦克会沿原方向继续滑行若干帧。
 */
export function updateIceSliding(tank: Tank, hasInput: boolean, context: MoveContext): void {
  const onIce = context.terrain.isIceAt(tank.x + TANK_SIZE / 2, tank.y + TANK_SIZE / 2)

  if (hasInput) {
    // 主动输入已完成本帧移动；离开冰面时清除惯性，不能再叠加一次位移。
    tank.slideTicks = onIce && tank.moving ? 12 : 0
    tank.slideDirection = tank.direction
    return
  }

  if (tank.slideTicks > 0) {
    tank.slideTicks -= 1
    const moved = tryMoveTank(tank, tank.slideDirection, context)
    if (!moved) {
      tank.slideTicks = 0
    }
  }
}

/** 把坦克限制在战场范围内。用于兜底，正常流程由地形边界拦住。 */
export function clampTankToField(tank: Tank, fieldPixels: number): void {
  tank.x = clamp(tank.x, 0, fieldPixels - TANK_SIZE)
  tank.y = clamp(tank.y, 0, fieldPixels - TANK_SIZE)
}

/** 坦克中心所在的格坐标 */
export function getTankCell(tank: Tank): readonly [number, number] {
  return [
    Math.floor((tank.x + TANK_SIZE / 2) / CELL_SIZE),
    Math.floor((tank.y + TANK_SIZE / 2) / CELL_SIZE),
  ]
}
