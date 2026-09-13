import { BULLET_SIZE } from '@/games/tank-battle/constants.ts'
import { nextEntityId } from '@/games/tank-battle/core/ids.ts'
import { Direction, TankSide, type Rect } from '@/games/tank-battle/types.ts'

interface BulletInit {
  readonly ownerId: string
  readonly ownerSide: TankSide
  readonly x: number
  readonly y: number
  readonly direction: Direction
  readonly speed: number
  /** >= 2 时可击穿钢墙 */
  readonly power: number
}

/** 子弹实体：纯状态容器，推进与碰撞由 BulletSystem / CollisionSystem 负责。 */
export class Bullet {
  readonly id: string
  readonly ownerId: string
  readonly ownerSide: TankSide
  readonly direction: Direction
  readonly speed: number
  readonly power: number

  x: number
  y: number
  alive = true

  constructor(init: BulletInit) {
    this.id = nextEntityId('bullet')
    this.ownerId = init.ownerId
    this.ownerSide = init.ownerSide
    this.x = init.x
    this.y = init.y
    this.direction = init.direction
    this.speed = init.speed
    this.power = init.power
  }

  getRect(): Rect {
    return { x: this.x, y: this.y, width: BULLET_SIZE, height: BULLET_SIZE }
  }
}
