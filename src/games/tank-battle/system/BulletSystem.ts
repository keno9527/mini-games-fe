import { BULLET_SIZE, TANK_SIZE } from '@/games/tank-battle/constants.ts'
import { rectsIntersect } from '@/games/tank-battle/core/geometry.ts'
import { Bullet } from '@/games/tank-battle/entity/Bullet.ts'
import type { Tank } from '@/games/tank-battle/entity/Tank.ts'
import { SoundEffect, TankSide, type Direction } from '@/games/tank-battle/types.ts'
import { getDirectionVector } from '@/games/tank-battle/system/MovementSystem.ts'
import { dropPowerUp } from '@/games/tank-battle/system/PowerUpSystem.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/** 开火后的冷却帧数 */
const FIRE_COOLDOWN_TICKS = 12

/**
 * 让坦克开火。
 *
 * 受两个约束：冷却未结束不能开火；同屏自身子弹数不能超过 spec.maxBullets。
 *
 * @returns 是否真的发射了子弹
 */
export function fireBullet(world: World, tank: Tank): boolean {
  if (tank.fireCooldownTicks > 0 || tank.isSpawning() || !tank.alive) {
    return false
  }

  const spec = tank.getSpec()
  const ownBullets = world.bullets.filter(
    (bullet) => bullet.alive && bullet.ownerId === tank.id,
  ).length
  if (ownBullets >= spec.maxBullets) {
    return false
  }

  const [spawnX, spawnY] = getMuzzlePosition(tank.x, tank.y, tank.direction)
  world.bullets.push(
    new Bullet({
      ownerId: tank.id,
      ownerSide: tank.side,
      x: spawnX,
      y: spawnY,
      direction: tank.direction,
      speed: spec.bulletSpeed,
      power: spec.bulletPower,
    }),
  )

  tank.fireCooldownTicks = FIRE_COOLDOWN_TICKS
  tank.muzzleFlashTicks = 5
  return true
}

/** 计算炮口位置：子弹从坦克该方向边缘的中点射出 */
function getMuzzlePosition(
  tankX: number,
  tankY: number,
  direction: Direction,
): readonly [number, number] {
  const [dx, dy] = getDirectionVector(direction)
  const centerX = tankX + TANK_SIZE / 2 - BULLET_SIZE / 2
  const centerY = tankY + TANK_SIZE / 2 - BULLET_SIZE / 2
  const offset = TANK_SIZE / 2 - BULLET_SIZE / 2
  return [centerX + dx * offset, centerY + dy * offset]
}

/** 玩家开火并播放音效 */
export function firePlayerBullet(
  world: World,
  tank: Tank,
  playSound: (effect: SoundEffect) => void,
): void {
  if (fireBullet(world, tank)) {
    playSound(SoundEffect.FIRE)
  }
}

/** 敌方开火（不播放音效，避免多辆坦克同时开火时音频过载） */
export function fireEnemyBullet(world: World, tank: Tank): void {
  fireBullet(world, tank)
}

/**
 * 推进所有子弹并结算碰撞。
 *
 * 关键点：子弹按不超过自身尺寸的步长分段推进，每段都做一次碰撞检测。
 * 若单帧一次性位移（速度 3~4px），子弹可能跨过 4px 的砖块子块而不触发
 * 检测，造成穿墙 —— 分段推进彻底消除了这个隧道效应。
 */
export function updateBullets(world: World, playSound: (effect: SoundEffect) => void): void {
  for (const bullet of world.bullets) {
    if (!bullet.alive) {
      continue
    }

    const [dx, dy] = getDirectionVector(bullet.direction)
    let remaining = bullet.speed

    while (remaining > 0 && bullet.alive) {
      const step = Math.min(BULLET_SIZE, remaining)
      remaining -= step
      bullet.x += dx * step
      bullet.y += dy * step

      resolveBulletCollisions(world, bullet, playSound)
    }
  }
}

/** 单段位移后的碰撞结算：地形 → 基地 → 坦克 → 子弹互撞 */
function resolveBulletCollisions(
  world: World,
  bullet: Bullet,
  playSound: (effect: SoundEffect) => void,
): void {
  const rect = bullet.getRect()

  // 1. 地形（含战场边界）
  const terrainHit = world.terrain.hitByBullet(rect, bullet.power, bullet.direction)
  if (terrainHit.hit) {
    bullet.alive = false
    world.addExplosionAt(rect.x + rect.width / 2, rect.y + rect.height / 2, false)
    playSound(terrainHit.destroyed ? SoundEffect.HIT_TERRAIN : SoundEffect.HIT_STEEL)
    return
  }

  // 2. 基地：任何阵营的子弹都能击毁，玩家误伤自家基地同样导致失败（贴合原作）
  if (!world.base.destroyed && rectsIntersect(rect, world.base.getRect())) {
    bullet.alive = false
    world.onBaseDestroyed()
    playSound(SoundEffect.EXPLODE_BIG)
    return
  }

  // 3. 坦克
  if (bullet.ownerSide === TankSide.PLAYER) {
    for (const enemy of world.enemies) {
      if (!enemy.alive || enemy.isSpawning()) {
        continue
      }
      if (!rectsIntersect(rect, enemy.getRect())) {
        continue
      }
      bullet.alive = false
      handleEnemyHit(world, enemy, playSound)
      return
    }
  } else {
    const player = world.player
    if (
      player !== null &&
      player.alive &&
      !player.isSpawning() &&
      rectsIntersect(rect, player.getRect())
    ) {
      bullet.alive = false
      if (player.isInvulnerable()) {
        // 护盾生效：子弹消失但玩家无损
        world.addExplosionAt(rect.x + rect.width / 2, rect.y + rect.height / 2, false)
        return
      }
      if (player.takeHit()) {
        world.onPlayerDestroyed()
        playSound(SoundEffect.EXPLODE_BIG)
      }
      return
    }
  }

  // 4. 敌我子弹对撞：双方抵消
  for (const other of world.bullets) {
    if (!other.alive || other.id === bullet.id || other.ownerSide === bullet.ownerSide) {
      continue
    }
    if (rectsIntersect(rect, other.getRect())) {
      bullet.alive = false
      other.alive = false
      return
    }
  }
}

/** 敌方坦克被命中：结算装甲、得分与掉落 */
function handleEnemyHit(world: World, enemy: Tank, playSound: (effect: SoundEffect) => void): void {
  const rect = enemy.getRect()

  if (enemy.bonusCarrier) {
    enemy.bonusCarrier = false
    dropPowerUp(world)
    playSound(SoundEffect.BONUS_APPEAR)
  }
  if (!enemy.takeHit()) {
    // 重甲坦克未被击毁，仅播放命中音效
    playSound(SoundEffect.HIT_ARMOR)
    return
  }

  world.addExplosionAt(rect.x + rect.width / 2, rect.y + rect.height / 2, true)
  world.addScore(enemy.getSpec().score)
  world.enemiesKilled += 1
  if (enemy.enemyKind !== null) world.stageKills[enemy.enemyKind] += 1
  playSound(SoundEffect.EXPLODE_SMALL)
}
