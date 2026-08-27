/** 全局共享的类型与枚举定义。 */

/** 四方向。数值顺序用于精灵索引，不可随意调整。 */
export enum Direction {
  UP = 0,
  RIGHT = 1,
  DOWN = 2,
  LEFT = 3,
}

/** 地形种类 */
export enum TerrainKind {
  EMPTY = 0,
  BRICK = 1,
  STEEL = 2,
  WATER = 3,
  TREE = 4,
  ICE = 5,
}

/** 坦克阵营 */
export enum TankSide {
  PLAYER = 'player',
  ENEMY = 'enemy',
}

/** 敌方坦克类型 */
export enum EnemyKind {
  BASIC = 'basic',
  FAST = 'fast',
  POWER = 'power',
  ARMOR = 'armor',
}

/** 道具种类 */
export enum PowerUpKind {
  GRENADE = 'grenade',
  HELMET = 'helmet',
  SHOVEL = 'shovel',
  STAR = 'star',
  TANK = 'tank',
  TIMER = 'timer',
}

/** 音效种类 */
export enum SoundEffect {
  FIRE = 'fire',
  HIT_TERRAIN = 'hitTerrain',
  EXPLODE_SMALL = 'explodeSmall',
  EXPLODE_BIG = 'explodeBig',
  PICKUP = 'pickup',
  LEVEL_START = 'levelStart',
  GAME_OVER = 'gameOver',
}

/** 场景种类 */
export enum SceneKind {
  TITLE = 'title',
  BATTLE = 'battle',
  GAME_OVER = 'gameOver',
}

/** 一帧内的输入快照，不可变以避免 tick 中途输入抖动 */
export interface InputSnapshot {
  readonly up: boolean
  readonly down: boolean
  readonly left: boolean
  readonly right: boolean
  readonly fire: boolean
  /** 暂停为边沿触发：仅在按下的那一帧为 true */
  readonly pauseEdge: boolean
  /** 确认键（开始游戏 / 重开）边沿触发 */
  readonly confirmEdge: boolean
}

/** 轴对齐矩形，单位为逻辑像素 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 子弹击中地形的结果 */
export interface TerrainHitResult {
  /** 是否命中了阻挡子弹的地形 */
  hit: boolean
  /** 是否真正破坏了地形（钢墙被弱子弹击中时 hit 为 true 但 destroyed 为 false） */
  destroyed: boolean
}

/** 关卡数据。地形用字符矩阵表达，便于直接手写与阅读。 */
export interface LevelData {
  /**
   * GRID_SIZE 行字符串，每行 GRID_SIZE 个字符：
   * `.` 空地 / `#` 砖墙 / `@` 钢墙 / `~` 水 / `*` 草地 / `%` 冰面
   */
  readonly terrain: readonly string[]
  /** 本关敌方坦克按出场顺序的类型配额，长度应等于 ENEMIES_PER_LEVEL */
  readonly enemyQueue: readonly EnemyKind[]
}

/** 敌方 / 玩家坦克的属性配置 */
export interface TankSpec {
  /** 每帧移动的逻辑像素数 */
  readonly moveSpeed: number
  /** 子弹每帧移动的逻辑像素数 */
  readonly bulletSpeed: number
  /** 可承受的击中次数 */
  readonly armor: number
  /** 同屏可存在的自身子弹数 */
  readonly maxBullets: number
  /** 子弹威力：>= 2 可击穿钢墙 */
  readonly bulletPower: number
  /** 击毁得分 */
  readonly score: number
}
