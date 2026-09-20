import {
  CELL_SIZE,
  ENEMY_SPAWN_INTERVAL_TICKS,
  MAX_ACTIVE_ENEMIES,
  SPAWN_BLINK_TICKS,
  TANK_SIZE,
} from '@/games/tank-battle/constants.ts'
import { rectsIntersect } from '@/games/tank-battle/core/geometry.ts'
import {
  ENEMY_SPAWN_CELLS,
  PLAYER_SPAWN_CELLS,
  BONUS_ENEMY_ORDINALS,
} from '@/games/tank-battle/data/levels.ts'
import { Tank } from '@/games/tank-battle/entity/Tank.ts'
import { Direction, TankSide, type Rect } from '@/games/tank-battle/types.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/**
 * 敌方生成管理。
 *
 * 每关 ENEMIES_PER_LEVEL 辆，同屏上限 MAX_ACTIVE_ENEMIES 辆，
 * 三个生成点轮转使用。新生成的坦克带 SPAWN_BLINK_TICKS 帧的闪烁保护期，
 * 期间既不可被击毁也不造成伤害 —— 避免玩家守着生成点秒杀，也避免
 * 坦克在生成点互相顶死。
 */
export function updateSpawning(world: World): void {
  updatePlayerRespawn(world)

  if (world.pendingEnemies.length === 0) {
    return
  }
  if (world.enemies.length >= MAX_ACTIVE_ENEMIES) {
    return
  }

  if (world.spawnCountdownTicks > 0) {
    world.spawnCountdownTicks -= 1
    return
  }

  const spawnCell = findAvailableSpawnCell(world)
  if (spawnCell === null) {
    // 所有生成点都被占用，下一帧再试
    return
  }

  const kind = world.pendingEnemies.shift()
  if (kind === undefined) {
    return
  }

  const enemy = new Tank({
    side: TankSide.ENEMY,
    x: spawnCell[0] * CELL_SIZE,
    y: spawnCell[1] * CELL_SIZE,
    direction: Direction.DOWN,
    enemyKind: kind,
  })
  enemy.spawnBlinkTicks = SPAWN_BLINK_TICKS
  enemy.bonusCarrier = BONUS_ENEMY_ORDINALS.includes(20 - world.pendingEnemies.length)
  if (enemy.bonusCarrier) world.powerUps = []
  world.terrain.clearSpawnCell(...spawnCell)
  world.enemies.push(enemy)

  world.spawnCountdownTicks = Math.max(50, ENEMY_SPAWN_INTERVAL_TICKS - (world.levelIndex + 1) * 4)
}

/**
 * 从轮转位置开始查找一个未被坦克占用的生成点。
 * 找到后推进轮转索引，使三个生成点被均匀使用。
 */
function findAvailableSpawnCell(world: World): readonly [number, number] | null {
  const total = ENEMY_SPAWN_CELLS.length

  for (let offset = 0; offset < total; offset += 1) {
    const index = (world.nextSpawnPointIndex + offset) % total
    const cell = ENEMY_SPAWN_CELLS[index]
    const rect: Rect = {
      x: cell[0] * CELL_SIZE,
      y: cell[1] * CELL_SIZE,
      width: TANK_SIZE,
      height: TANK_SIZE,
    }

    if (isOccupied(world, rect)) {
      continue
    }

    world.nextSpawnPointIndex = (index + 1) % total
    return cell
  }

  return null
}

/** 生成点是否被任何坦克占用 */
function isOccupied(world: World, rect: Rect): boolean {
  for (const enemy of world.enemies) {
    if (enemy.alive && rectsIntersect(rect, enemy.getRect())) {
      return true
    }
  }
  if (world.getPlayerTanks().some((player) => rectsIntersect(rect, player.getRect()))) return true
  return false
}

/** 玩家阵亡后的重生倒计时 */
function updatePlayerRespawn(world: World): void {
  world.players.forEach((player, slot) => {
    if (player.tank !== null || player.respawnDelayTicks <= 0) return
    player.respawnDelayTicks -= 1
    if (player.respawnDelayTicks <= 0) {
      const cell = PLAYER_SPAWN_CELLS[slot]
      const rect = {
        x: cell[0] * CELL_SIZE,
        y: cell[1] * CELL_SIZE,
        width: TANK_SIZE,
        height: TANK_SIZE,
      }
      if (isOccupied(world, rect)) player.respawnDelayTicks = 1
      else world.spawnPlayer(false, slot)
    }
  })
}
