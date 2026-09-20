import {
  FREEZE_TICKS,
  GRID_SIZE,
  HELMET_SHIELD_TICKS,
  SHOVEL_TICKS,
} from '@/games/tank-battle/constants.ts'
import { rectsIntersect } from '@/games/tank-battle/core/geometry.ts'
import { POWERUP_SCORE } from '@/games/tank-battle/data/tankSpecs.ts'
import { PowerUp } from '@/games/tank-battle/entity/PowerUp.ts'
import { PowerUpKind, SoundEffect } from '@/games/tank-battle/types.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/** 所有道具种类，用于随机抽取 */
// $E8FA: star and grenade each occupy two of the eight random slots.
const ALL_KINDS: readonly PowerUpKind[] = [
  PowerUpKind.HELMET,
  PowerUpKind.TIMER,
  PowerUpKind.SHOVEL,
  PowerUpKind.STAR,
  PowerUpKind.GRENADE,
  PowerUpKind.TANK,
  PowerUpKind.GRENADE,
  PowerUpKind.STAR,
]

/** 随机寻找空地的最大尝试次数，超出则放弃本次掉落 */
const MAX_PLACEMENT_ATTEMPTS = 40

/** A flashing carrier drops one bonus on its first hit ($E7D1). */
export function dropPowerUp(world: World): void {
  const cell = findFreeCell(world)
  if (cell === null) return
  const kind = world.rng.pick(ALL_KINDS) ?? PowerUpKind.STAR
  world.powerUps = [new PowerUp(kind, cell[0], cell[1])]
}

/** 随机找一个可放置道具的空地格 */
function findFreeCell(world: World): readonly [number, number] | null {
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const cellX = world.rng.nextInt(GRID_SIZE)
    const cellY = world.rng.nextInt(GRID_SIZE)

    if (!world.terrain.isCellFree(cellX, cellY)) {
      continue
    }
    // 不要生成在基地格上
    if (cellX === world.base.cellX && cellY === world.base.cellY) {
      continue
    }
    return [cellX, cellY]
  }
  // Dense maps still receive their earned reward; scan instead of losing the drop.
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (world.terrain.isCellFree(x, y) && !(x === world.base.cellX && y === world.base.cellY))
        return [x, y]
    }
  }
  return null
}

/**
 * 检测玩家拾取道具并结算效果。
 */
export function updatePowerUps(world: World, playSound: (effect: SoundEffect) => void): void {
  for (const powerUp of world.powerUps) {
    powerUp.tickTimers()
  }

  const player = world.player
  if (player === null || !player.alive) {
    return
  }

  const playerRect = player.getRect()
  for (const powerUp of world.powerUps) {
    if (!powerUp.alive || !rectsIntersect(playerRect, powerUp.getRect())) {
      continue
    }
    powerUp.alive = false
    applyPowerUpEffect(world, powerUp.kind, playSound)
    world.addScore(POWERUP_SCORE)
    playSound(powerUp.kind === PowerUpKind.TANK ? SoundEffect.EXTRA_LIFE : SoundEffect.PICKUP)
  }
}

/** 结算单个道具的效果 */
function applyPowerUpEffect(
  world: World,
  kind: PowerUpKind,
  playSound: (effect: SoundEffect) => void,
): void {
  switch (kind) {
    case PowerUpKind.GRENADE:
      destroyAllEnemies(world, playSound)
      break

    case PowerUpKind.HELMET:
      if (world.player !== null) {
        world.player.shieldTicks = HELMET_SHIELD_TICKS
      }
      break

    case PowerUpKind.SHOVEL:
      world.terrain.applyShovel()
      world.shovelTicks = SHOVEL_TICKS
      break

    case PowerUpKind.STAR:
      world.player?.upgrade()
      break

    case PowerUpKind.TANK:
      world.playerLives += 1
      break

    case PowerUpKind.TIMER:
      world.freezeTicks = FREEZE_TICKS
      break

    default:
      break
  }
}

/** 手雷：清除场上全部敌方坦克，不计分（贴合原作） */
function destroyAllEnemies(world: World, playSound: (effect: SoundEffect) => void): void {
  let destroyedAny = false
  for (const enemy of world.enemies) {
    if (!enemy.alive || enemy.isSpawning()) {
      continue
    }
    enemy.alive = false
    const rect = enemy.getRect()
    world.addExplosionAt(rect.x + rect.width / 2, rect.y + rect.height / 2, true)
    world.enemiesKilled += 1
    destroyedAny = true
  }
  if (destroyedAny) {
    playSound(SoundEffect.EXPLODE_BIG)
  }
}

/** 推进道具相关的全局计时器（冻结、铲子） */
export function updatePowerUpTimers(world: World): void {
  if (world.freezeTicks > 0) {
    world.freezeTicks -= 1
  }

  if (world.shovelTicks > 0) {
    world.shovelTicks -= 1
    if (world.shovelTicks === 0) {
      world.terrain.revertShovel()
    }
  }
}
