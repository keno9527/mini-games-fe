import { BULLET_SIZE, TANK_SIZE } from '@/games/tank-battle/constants.ts'
import type { Tank } from '@/games/tank-battle/entity/Tank.ts'
import { Direction, type Rect } from '@/games/tank-battle/types.ts'
import { fireEnemyBullet } from '@/games/tank-battle/system/BulletSystem.ts'
import {
  canMoveTank,
  getDirectionVector,
  tryMoveTank,
  type MoveContext,
} from '@/games/tank-battle/system/MovementSystem.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/** 重新决策方向的间隔下限（逻辑帧） */
const DECISION_INTERVAL_MIN = 24

/** 重新决策方向的间隔上限（逻辑帧） */
const DECISION_INTERVAL_MAX = 72

/**
 * 每帧开火的基础概率。
 *
 * 该值经实测校准：4 辆同屏时总火力约 1 发/秒。早期取 0.02 会导致
 * 近 4 发/秒的弹幕，玩家几乎无法生存。
 */
const FIRE_CHANCE_PER_TICK = 0.006

/** 朝向目标时的开火概率倍数 */
const ALIGNED_FIRE_MULTIPLIER = 3

/**
 * 决策权重：趋向基地 / 趋向玩家 / 纯随机。
 *
 * 随机权重刻意占主导 —— 原作敌方 AI 本质是「带轻微偏好的随机游走」。
 * 早期把趋向基地设为最高权重(5)，导致所有敌人径直扑向老鹰、约 23 秒
 * 就能拆掉基地围墙，关卡实测不可通关。
 */
const WEIGHT_TOWARD_BASE = 1
const WEIGHT_TOWARD_PLAYER = 2
const WEIGHT_RANDOM = 7

const ALL_DIRECTIONS: readonly Direction[] = [
  Direction.UP,
  Direction.RIGHT,
  Direction.DOWN,
  Direction.LEFT,
]

/**
 * 敌方坦克 AI。
 *
 * 刻意不使用 A* 等寻路算法 —— 原作的敌方 AI 本身就是「带偏好的随机游走」，
 * 引入精确寻路会让敌人过于聪明、手感失真。这里用加权随机在三种意图之间
 * 选择：轻微趋向基地、趋向玩家、以随机游走为主的探索。
 *
 * 重新决策的时机有两个：决策计时器归零，或撞墙无法前进。
 */
export function updateEnemyAi(world: World): void {
  // 计时器道具生效期间敌方完全冻结
  if (world.freezeTicks > 0) {
    for (const enemy of world.enemies) {
      enemy.moving = false
    }
    return
  }

  for (const enemy of world.enemies) {
    if (!enemy.alive) {
      continue
    }

    // 出生保护期内只做计时，不行动
    if (enemy.isSpawning()) {
      enemy.moving = false
      continue
    }

    if (enemy.aiDecisionTicks > 0) {
      enemy.aiDecisionTicks -= 1
    }

    const context: MoveContext = {
      terrain: world.terrain,
      otherTanks: buildObstacleList(world, enemy),
      baseRect: world.base.destroyed ? null : world.base.getRect(),
    }
    const shouldRedecide =
      enemy.aiDecisionTicks <= 0 || !canMoveTank(enemy, enemy.direction, context)
    const direction = shouldRedecide ? decideDirection(world, enemy, context) : enemy.direction
    if (shouldRedecide) {
      resetDecisionTimer(world, enemy)
    }

    const moved = tryMoveTank(enemy, direction, context)

    // 撞墙立即重新决策，否则会贴着墙抖动
    if (!moved) {
      enemy.aiDecisionTicks = 0
    }

    maybeFire(world, enemy)
  }
}

/** 构造该坦克需要避让的其他坦克列表 */
function buildObstacleList(world: World, self: Tank): Tank[] {
  const obstacles: Tank[] = []
  for (const other of world.enemies) {
    if (other.id !== self.id) {
      obstacles.push(other)
    }
  }
  if (world.player !== null) {
    obstacles.push(world.player)
  }
  return obstacles
}

/** 按加权随机选择本次的移动方向 */
function decideDirection(world: World, enemy: Tank, context: MoveContext): Direction {
  const available = ALL_DIRECTIONS.filter((direction) => canMoveTank(enemy, direction, context))
  // 被完全围住时保留朝向，仍可开火打通砖墙。
  if (available.length === 0) return enemy.direction

  const intentIndex = world.rng.pickWeightedIndex([
    WEIGHT_TOWARD_BASE,
    WEIGHT_TOWARD_PLAYER,
    WEIGHT_RANDOM,
  ])

  if (intentIndex === 0) {
    const baseRect = world.base.getRect()
    return pickDirectionToward(world, enemy, baseRect, available)
  }

  if (intentIndex === 1 && world.player !== null && world.player.alive) {
    return pickDirectionToward(world, enemy, world.player.getRect(), available)
  }

  return world.rng.pick(available) ?? enemy.direction
}

/**
 * 朝目标方向选一个可行的轴。
 *
 * 在水平与垂直两个候选轴中按距离差加权 —— 距离差大的轴优先，
 * 使坦克呈现「先走长边」的自然移动感。若首选方向被挡则退化为次选。
 */
function pickDirectionToward(
  world: World,
  enemy: Tank,
  target: Rect,
  available: readonly Direction[],
): Direction {
  const enemyCenterX = enemy.x + TANK_SIZE / 2
  const enemyCenterY = enemy.y + TANK_SIZE / 2
  const targetCenterX = target.x + target.width / 2
  const targetCenterY = target.y + target.height / 2

  const deltaX = targetCenterX - enemyCenterX
  const deltaY = targetCenterY - enemyCenterY

  const horizontal = deltaX >= 0 ? Direction.RIGHT : Direction.LEFT
  const vertical = deltaY >= 0 ? Direction.DOWN : Direction.UP

  const preferHorizontal = world.rng.pickWeightedIndex([Math.abs(deltaX), Math.abs(deltaY)]) === 0

  const first = preferHorizontal ? horizontal : vertical
  const second = preferHorizontal ? vertical : horizontal

  if (available.includes(first)) return first
  if (available.includes(second)) return second
  return world.rng.pick(available) ?? enemy.direction
}

function resetDecisionTimer(world: World, enemy: Tank): void {
  const span = DECISION_INTERVAL_MAX - DECISION_INTERVAL_MIN
  enemy.aiDecisionTicks = DECISION_INTERVAL_MIN + world.rng.nextInt(span + 1)
}

/**
 * 开火判定：基础概率 + 对准玩家或基地时显著提升。
 */
function maybeFire(world: World, enemy: Tank): void {
  let chance = FIRE_CHANCE_PER_TICK

  if (isAlignedWithTarget(enemy, world)) {
    chance *= ALIGNED_FIRE_MULTIPLIER
  }

  if (world.rng.chance(chance)) {
    fireEnemyBullet(world, enemy)
  }
}

/** 坦克当前朝向是否大致对准了玩家或基地 */
function isAlignedWithTarget(enemy: Tank, world: World): boolean {
  const targets: Rect[] = []
  if (world.player !== null && world.player.alive) {
    targets.push(world.player.getRect())
  }
  if (!world.base.destroyed) {
    targets.push(world.base.getRect())
  }

  const [dx, dy] = getDirectionVector(enemy.direction)
  const enemyCenterX = enemy.x + TANK_SIZE / 2
  const enemyCenterY = enemy.y + TANK_SIZE / 2

  for (const target of targets) {
    const targetCenterX = target.x + target.width / 2
    const targetCenterY = target.y + target.height / 2

    if (dx !== 0) {
      // 水平朝向：目标需在同一水平带内，且位于朝向一侧
      const sameRow = Math.abs(targetCenterY - enemyCenterY) < (target.height + BULLET_SIZE) / 2
      const inFront = (targetCenterX - enemyCenterX) * dx > 0
      if (sameRow && inFront && hasClearSteelPath(world, enemy, target)) {
        return true
      }
    } else {
      const sameColumn = Math.abs(targetCenterX - enemyCenterX) < (target.width + BULLET_SIZE) / 2
      const inFront = (targetCenterY - enemyCenterY) * dy > 0
      if (sameColumn && inFront && hasClearSteelPath(world, enemy, target)) {
        return true
      }
    }
  }

  return false
}

/** 只排除无法打穿的钢墙；砖墙保留瞄准权重，让敌人仍能逐步开路。 */
function hasClearSteelPath(world: World, enemy: Tank, target: Rect): boolean {
  const [dx, dy] = getDirectionVector(enemy.direction)
  const centerX = enemy.x + TANK_SIZE / 2
  const centerY = enemy.y + TANK_SIZE / 2
  const targetNearEdge =
    dx > 0
      ? target.x
      : dx < 0
        ? target.x + target.width
        : dy > 0
          ? target.y
          : target.y + target.height
  const distance = dx !== 0 ? (targetNearEdge - centerX) * dx : (targetNearEdge - centerY) * dy
  for (let step = TANK_SIZE / 2; step < distance; step += 1) {
    // 子弹横截面的两侧都检测，避免擦着钢墙边缘仍获得瞄准加成。
    for (const offset of [-BULLET_SIZE / 2, BULLET_SIZE / 2 - 0.01]) {
      const x = centerX + dx * step + (dy !== 0 ? offset : 0)
      const y = centerY + dy * step + (dx !== 0 ? offset : 0)
      if (world.terrain.isSteelAt(x, y)) {
        return false
      }
    }
  }
  return true
}
