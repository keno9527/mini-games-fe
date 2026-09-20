import { TANK_SIZE } from '@/games/tank-battle/constants.ts'
import { nextEntityId } from '@/games/tank-battle/core/ids.ts'
import { ENEMY_SPECS, MAX_PLAYER_STAR, PLAYER_SPECS } from '@/games/tank-battle/data/tankSpecs.ts'
import {
  Direction,
  EnemyKind,
  TankSide,
  type Rect,
  type TankSpec,
} from '@/games/tank-battle/types.ts'

interface TankInit {
  readonly side: TankSide
  readonly x: number
  readonly y: number
  readonly direction: Direction
  /** 敌方坦克类型；玩家坦克传 null */
  readonly enemyKind: EnemyKind | null
}

/**
 * 坦克实体：纯状态容器 + 自身状态查询。
 *
 * 不直接操作其他实体，也不引用任何 DOM / Canvas API ——
 * 移动、碰撞、开火等跨实体规则全部由 system 层负责。
 */
export class Tank {
  readonly id: string
  readonly side: TankSide
  readonly enemyKind: EnemyKind | null

  x: number
  y: number
  direction: Direction

  /** 剩余可承受的命中次数 */
  armor: number
  /** 初始装甲值，用于重甲坦克按剩余比例变色 */
  readonly maxArmor: number

  /** 玩家星级（0-3）；敌方恒为 0 */
  playerSlot = 0
  star = 0

  /** 无敌剩余帧数（重生保护 / 头盔道具） */
  shieldTicks = 0
  /** 出生闪烁保护剩余帧数：期间不可被击毁也不造成伤害 */
  spawnBlinkTicks = 0

  /** 开火冷却剩余帧数 */
  fireCooldownTicks = 0
  /** 短时战斗反馈，仅随逻辑帧推进。 */
  muzzleFlashTicks = 0
  hitFlashTicks = 0

  /** 本帧是否发生了移动，用于履带动画 */
  moving = false
  /** 履带动画相位 */
  treadPhase = 0

  /** 冰面滑行剩余帧数：>0 时即使无输入也继续沿 slideDirection 移动 */
  slideTicks = 0
  slideDirection: Direction = Direction.UP

  /** AI 重新决策的倒计时（仅敌方使用） */
  aiDecisionTicks = 0

  bonusCarrier = false
  bonusFlashTicks = 0

  alive = true

  constructor(init: TankInit) {
    this.id = nextEntityId(init.side === TankSide.PLAYER ? 'player' : 'enemy')
    this.side = init.side
    this.enemyKind = init.enemyKind
    this.x = init.x
    this.y = init.y
    this.direction = init.direction

    const spec = this.getSpec()
    this.armor = spec.armor
    this.maxArmor = spec.armor
  }

  /** 当前生效的属性：玩家取星级对应档位，敌方取类型配置 */
  getSpec(): TankSpec {
    if (this.side === TankSide.PLAYER) {
      const index = Math.min(Math.max(this.star, 0), MAX_PLAYER_STAR)
      return PLAYER_SPECS[index]
    }
    // 敌方坦克必然带 enemyKind；缺失时退化为基础型而非抛错，保证战场不中断
    return ENEMY_SPECS[this.enemyKind ?? EnemyKind.BASIC]
  }

  getRect(): Rect {
    return { x: this.x, y: this.y, width: TANK_SIZE, height: TANK_SIZE }
  }

  /** 是否处于任何形式的无敌状态 */
  isInvulnerable(): boolean {
    return this.shieldTicks > 0 || this.spawnBlinkTicks > 0
  }

  /** 出生保护期内的坦克不参与碰撞与射击 */
  isSpawning(): boolean {
    return this.spawnBlinkTicks > 0
  }

  /** 玩家升级一星，已满级则返回 false */
  upgrade(): boolean {
    if (this.side !== TankSide.PLAYER || this.star >= MAX_PLAYER_STAR) {
      return false
    }
    this.star += 1
    return true
  }

  /** 施加一次命中。返回 true 表示本次命中导致坦克被击毁。 */
  takeHit(): boolean {
    if (this.isInvulnerable()) {
      return false
    }
    this.hitFlashTicks = 8
    this.armor -= 1
    if (this.armor <= 0) {
      this.alive = false
      return true
    }
    return false
  }

  /** 每帧推进自身计时器 */
  tickTimers(): void {
    this.bonusFlashTicks = (this.bonusFlashTicks + 1) % 32
    if (this.muzzleFlashTicks > 0) this.muzzleFlashTicks -= 1
    if (this.hitFlashTicks > 0) this.hitFlashTicks -= 1
    if (this.shieldTicks > 0) {
      this.shieldTicks -= 1
    }
    if (this.spawnBlinkTicks > 0) {
      this.spawnBlinkTicks -= 1
    }
    if (this.fireCooldownTicks > 0) {
      this.fireCooldownTicks -= 1
    }
    if (this.moving) {
      this.treadPhase = (this.treadPhase + 1) % 8
    }
  }
}
