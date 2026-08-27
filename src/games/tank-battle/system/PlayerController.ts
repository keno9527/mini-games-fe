import { FIELD_PIXELS } from '@/games/tank-battle/constants.ts'
import { Direction, SoundEffect, type InputSnapshot } from '@/games/tank-battle/types.ts'
import { firePlayerBullet } from '@/games/tank-battle/system/BulletSystem.ts'
import {
  clampTankToField,
  tryMoveTank,
  updateIceSliding,
} from '@/games/tank-battle/system/MovementSystem.ts'
import type { World } from '@/games/tank-battle/system/World.ts'

/**
 * 把输入快照转换为玩家坦克的行为。
 *
 * 方向优先级为「上 → 下 → 左 → 右」，同时按住多个方向时只取优先级最高的一个，
 * 避免斜向移动破坏格子对齐。
 */
export function updatePlayer(
  world: World,
  input: InputSnapshot,
  playSound: (effect: SoundEffect) => void,
): void {
  const player = world.player
  if (player === null || !player.alive) {
    return
  }

  const direction = resolveDirection(input)
  const moveContext = {
    terrain: world.terrain,
    otherTanks: world.enemies,
    baseRect: world.base.destroyed ? null : world.base.getRect(),
  }

  if (direction !== null) {
    tryMoveTank(player, direction, moveContext)
  } else {
    player.moving = false
  }

  updateIceSliding(player, direction !== null, moveContext)
  clampTankToField(player, FIELD_PIXELS)

  if (input.fire) {
    firePlayerBullet(world, player, playSound)
  }
}

function resolveDirection(input: InputSnapshot): Direction | null {
  if (input.up) {
    return Direction.UP
  }
  if (input.down) {
    return Direction.DOWN
  }
  if (input.left) {
    return Direction.LEFT
  }
  if (input.right) {
    return Direction.RIGHT
  }
  return null
}
