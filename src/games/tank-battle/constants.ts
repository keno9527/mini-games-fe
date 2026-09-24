/**
 * 全局常量：战场尺寸、时间、速度等基础度量。
 *
 * 坐标体系说明：
 * - 战场为 GRID_SIZE x GRID_SIZE 个格子，每格 CELL_SIZE 逻辑像素。
 * - 实体位置与碰撞在「逻辑像素」精度上计算，不做格对齐，
 *   以复刻原作能钻进半格缝隙的移动手感。
 * - 砖墙以 1/4 格（BRICK_SUB 个子块）粒度破坏。
 */

/** 每个地形格的边长（逻辑像素） */
export const CELL_SIZE = 16

/** 战场为 13x13 格 */
export const GRID_SIZE = 13

/** 战场像素宽高 */
export const FIELD_PIXELS = CELL_SIZE * GRID_SIZE

/** 右侧信息栏宽度（逻辑像素） */
export const SIDEBAR_WIDTH = 32

/** 灰色外框偏移仅用于渲染，不改变实体和碰撞坐标。 */
export const FIELD_OFFSET_X = 16
export const FIELD_OFFSET_Y = 16

/** 画布逻辑宽度（战场 + 信息栏） */
export const CANVAS_WIDTH = FIELD_OFFSET_X + FIELD_PIXELS + SIDEBAR_WIDTH

/** 画布逻辑高度 */
export const CANVAS_HEIGHT = FIELD_PIXELS + FIELD_OFFSET_Y * 2

/** 砖墙每格在单轴上切分的子块数（4x4 = 16 个子块） */
export const BRICK_SUB = 4

/** 单个砖块子块的边长（逻辑像素） */
export const BRICK_SUB_SIZE = CELL_SIZE / BRICK_SUB

/** 逻辑帧率 */
export const TICKS_PER_SECOND = 60

/** 单个逻辑帧的时长（秒） */
export const TICK_SECONDS = 1 / TICKS_PER_SECOND

/** 单次 rAF 回调内最多补的逻辑帧数，防止切后台恢复时雪崩 */
export const MAX_TICKS_PER_FRAME = 5

/** 坦克边长（逻辑像素），与一格等宽 */
export const TANK_SIZE = CELL_SIZE

/** 子弹边长（逻辑像素） */
export const BULLET_SIZE = 4

/** 子弹每帧移动的逻辑像素数 */
export const BULLET_SPEED = 3

/** 高速子弹（装甲型敌人 / 玩家升级后）每帧移动的逻辑像素数 */
export const BULLET_SPEED_FAST = 4

/** 转向时非移动轴的吸附粒度（半格） */
export const TURN_SNAP = CELL_SIZE / 2

/** 玩家初始生命数 */
export const PLAYER_INITIAL_LIVES = 10

/** 每关敌方坦克总数 */
export const ENEMIES_PER_LEVEL = 20

/** 同屏敌方坦克上限 */
export const MAX_ACTIVE_ENEMIES = 4

/** 敌方生成间隔（逻辑帧） */
export const ENEMY_SPAWN_INTERVAL_TICKS = 190

/** 生成点闪烁保护时长（逻辑帧） */
export const SPAWN_BLINK_TICKS = 30

/** 玩家重生后的无敌时长（逻辑帧） */
export const RESPAWN_SHIELD_TICKS = 192

/** 头盔道具提供的无敌时长（逻辑帧） */
export const HELMET_SHIELD_TICKS = 640

/** 铲子道具的基地钢墙持续时长（逻辑帧） */
export const SHOVEL_TICKS = 1280

/** 计时器道具的敌方冻结时长（逻辑帧） */
export const FREEZE_TICKS = 640

/** 场上同时存在的道具上限 */
export const MAX_POWERUPS_ON_FIELD = 1

/** 爆炸动画总时长（逻辑帧） */
export const EXPLOSION_TICKS = 24

/** 关卡开场提示的持续时长（逻辑帧） */
// Let the sampled stage introduction finish before combat begins.
export const LEVEL_INTRO_TICKS = 270

/** 关卡结算画面的持续时长（逻辑帧） */
export const LEVEL_CLEAR_TICKS = 420
