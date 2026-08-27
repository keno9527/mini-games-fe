import { BULLET_SPEED, BULLET_SPEED_FAST } from '@/games/tank-battle/constants.ts'
import { EnemyKind, type TankSpec } from '@/games/tank-battle/types.ts'

/**
 * 四类敌方坦克的属性配置。
 *
 * - BASIC 普通：基准速度，一击即毁
 * - FAST  快速：移动速度翻倍，机动性强但脆
 * - POWER 装甲（火力型）：子弹速度更快，压制力强
 * - ARMOR 重甲：需 4 次命中才被击毁，每次受击变色
 */
export const ENEMY_SPECS: Readonly<Record<EnemyKind, TankSpec>> = {
  [EnemyKind.BASIC]: {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED,
    armor: 1,
    maxBullets: 1,
    bulletPower: 1,
    score: 100,
  },
  [EnemyKind.FAST]: {
    moveSpeed: 2,
    bulletSpeed: BULLET_SPEED,
    armor: 1,
    maxBullets: 1,
    bulletPower: 1,
    score: 200,
  },
  [EnemyKind.POWER]: {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED_FAST,
    armor: 1,
    maxBullets: 1,
    bulletPower: 1,
    score: 300,
  },
  [EnemyKind.ARMOR]: {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED,
    armor: 4,
    maxBullets: 1,
    bulletPower: 1,
    score: 400,
  },
}

/**
 * 玩家坦克按星级（0-3）的属性。
 *
 * - 0 星：基础形态
 * - 1 星：子弹加速
 * - 2 星：可同屏发射 2 发子弹
 * - 3 星：子弹威力 2，可击穿钢墙
 */
export const PLAYER_SPECS: readonly TankSpec[] = [
  {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED,
    armor: 1,
    maxBullets: 1,
    bulletPower: 1,
    score: 0,
  },
  {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED_FAST,
    armor: 1,
    maxBullets: 1,
    bulletPower: 1,
    score: 0,
  },
  {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED_FAST,
    armor: 1,
    maxBullets: 2,
    bulletPower: 1,
    score: 0,
  },
  {
    moveSpeed: 1,
    bulletSpeed: BULLET_SPEED_FAST,
    armor: 1,
    maxBullets: 2,
    bulletPower: 2,
    score: 0,
  },
]

/** 玩家最高星级 */
export const MAX_PLAYER_STAR = PLAYER_SPECS.length - 1

/** 拾取道具的固定得分 */
export const POWERUP_SCORE = 500
