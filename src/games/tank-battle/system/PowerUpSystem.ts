import {
  FREEZE_TICKS,
  GRID_SIZE,
  HELMET_SHIELD_TICKS,
  MAX_POWERUPS_ON_FIELD,
  POWERUP_DROP_CHANCE,
  SHOVEL_TICKS,
} from '@/games/tank-battle/constants.ts'
import { rectsIntersect } from '@/games/tank-battle/core/geometry.ts'
import { POWERUP_SCORE } from '@/games/tank-battle/data/tankSpecs.ts'
import { PowerUp } from '@/games/tank-battle/entity/PowerUp.ts'
import { PowerUpKind, SoundEffect } from '@/games/tank-battle/types.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/** 所有道具种类，用于随机抽取 */
const ALL_KINDS: readonly PowerUpKind[] = [
  PowerUpKind.GRENADE,
  PowerUpKind.HELMET,
  PowerUpKind.SHOVEL,
  PowerUpKind.STAR,
  PowerUpKind.TANK,
  PowerUpKind.TIMER,
]

/** 随机寻找空地的最大尝试次数，超出则放弃本次掉落 */
const MAX_PLACEMENT_ATTEMPTS = 40

/**
 * 敌方坦克被击毁时尝试掉落道具。
 *
 * 同屏道具数达到上限时不再掉落 —— 原作也是场上最多一个。
 */
export function tryDropPowerUp(world: World): void {
  if (world.powerUps.length >= MAX_POWERUPS_ON_FIELD) {
    return
  }
  if (!world.rng.chance(POWERUP_DROP_CHANCE)) {
    return
  }

  const cell = findFreeCell(world)
  if (cell === null) {
    return
  }

  const kind = world.rng.pick(ALL_KINDS) ?? PowerUpKind.STAR
  world.powerUps.push(new PowerUp(kind, cell[0], cell[1]))
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
  return null
}

/**
 * 检测玩家拾取道具并结算效果。
 */
export function updatePowerUps(world: World, playSound: (effect: SoundEffect) => void): void {
  for (const powerUp of world.powerUps) {
    powerUp.tickTimers()
  }

  for (const player of world.getPlayerTanks()) {
    const playerRect = player.getRect()
    for (const powerUp of world.powerUps) {
      if (!powerUp.alive || !rectsIntersect(playerRect, powerUp.getRect())) {
        continue
      }
      powerUp.alive = false
      applyPowerUpEffect(world, powerUp.kind, playSound, player.playerSlot)
      world.addScore(POWERUP_SCORE)
      playSound(SoundEffect.PICKUP)
    }
  }
}

/** 结算单个道具的效果 */
function applyPowerUpEffect(
  world: World,
  kind: PowerUpKind,
  playSound: (effect: SoundEffect) => void,
  slot: number,
): void {
  const player = world.players[slot]
  switch (kind) {
    case PowerUpKind.GRENADE:
      destroyAllEnemies(world, playSound)
      break

    case PowerUpKind.HELMET:
      if (player.tank !== null) {
        player.tank.shieldTicks = HELMET_SHIELD_TICKS
      }
      break

    case PowerUpKind.SHOVEL:
      world.terrain.applyShovel()
      world.shovelTicks = SHOVEL_TICKS
      break

    case PowerUpKind.STAR:
      player.tank?.upgrade()
      break

    case PowerUpKind.TANK:
      player.lives += 1
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
    if (!enemy.alive) {
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
