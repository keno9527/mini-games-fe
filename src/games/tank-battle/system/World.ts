import {
  CELL_SIZE,
  ENEMIES_PER_LEVEL,
  PLAYER_INITIAL_LIVES,
  RESPAWN_SHIELD_TICKS,
  SPAWN_BLINK_TICKS,
} from '@/games/tank-battle/constants.ts'
import { Rng } from '@/games/tank-battle/core/rng.ts'
import { LEVELS, PLAYER_SPAWN_CELL } from '@/games/tank-battle/data/levels.ts'
import { Base } from '@/games/tank-battle/entity/Base.ts'
import type { Bullet } from '@/games/tank-battle/entity/Bullet.ts'
import { Explosion } from '@/games/tank-battle/entity/Explosion.ts'
import type { PowerUp } from '@/games/tank-battle/entity/PowerUp.ts'
import { Tank } from '@/games/tank-battle/entity/Tank.ts'
import { Direction, TankSide, type EnemyKind } from '@/games/tank-battle/types.ts'
import { TerrainGrid } from '@/games/tank-battle/system/TerrainGrid.ts'

/** 关卡结束的原因 */
export enum LevelOutcome {
  ONGOING = 'ongoing',
  CLEARED = 'cleared',
  FAILED = 'failed',
}

/**
 * 战场状态容器。
 *
 * 只持有状态与最基础的状态变更方法，不实现跨实体规则 —— 那些属于各 system。
 * 不引用任何 DOM / Canvas API，因此可以在 Node 环境直接单测。
 */
export class World {
  readonly terrain: TerrainGrid
  readonly base = new Base()
  readonly rng: Rng

  player: Tank | null = null
  enemies: Tank[] = []
  bullets: Bullet[] = []
  powerUps: PowerUp[] = []
  explosions: Explosion[] = []

  levelIndex = 0
  score = 0
  highScore = 0
  playerLives = PLAYER_INITIAL_LIVES

  /** 本关剩余未出场的敌方队列 */
  pendingEnemies: EnemyKind[] = []
  /** 本关已被击毁的敌方数量 */
  enemiesKilled = 0

  /** 敌方冻结剩余帧数（计时器道具） */
  freezeTicks = 0
  /** 铲子道具剩余帧数 */
  shovelTicks = 0
  /** 距下一次敌方生成的剩余帧数 */
  spawnCountdownTicks = 0
  /** 下一个生成点的轮转索引 */
  nextSpawnPointIndex = 0

  /** 玩家重生等待帧数；> 0 表示玩家已阵亡待重生 */
  respawnDelayTicks = 0

  outcome: LevelOutcome = LevelOutcome.ONGOING

  constructor(seed: number, initialHighScore = 0) {
    this.rng = new Rng(seed)
    this.terrain = new TerrainGrid(LEVELS[0].terrain)
    this.highScore = initialHighScore
  }

  /** 本关剩余敌方总数（未出场 + 场上存活） */
  getEnemiesRemaining(): number {
    return this.pendingEnemies.length + this.enemies.length
  }

  /** 载入指定关卡并重置战场（保留分数与生命） */
  loadLevel(levelIndex: number): void {
    const clampedIndex = levelIndex % LEVELS.length
    this.levelIndex = levelIndex

    this.terrain.load(LEVELS[clampedIndex].terrain)
    this.base.reset()

    this.enemies = []
    this.bullets = []
    this.powerUps = []
    this.explosions = []

    this.pendingEnemies = [...LEVELS[clampedIndex].enemyQueue].slice(0, ENEMIES_PER_LEVEL)
    this.enemiesKilled = 0

    this.freezeTicks = 0
    this.shovelTicks = 0
    this.spawnCountdownTicks = 0
    this.nextSpawnPointIndex = 0
    this.respawnDelayTicks = 0
    this.outcome = LevelOutcome.ONGOING

    this.spawnPlayer(true)
  }

  /** 在出生点放置玩家坦克。keepStar 为 false 时星级归零（阵亡后降级）。 */
  spawnPlayer(keepStar: boolean): void {
    const previousStar = keepStar ? (this.player?.star ?? 0) : 0
    const tank = new Tank({
      side: TankSide.PLAYER,
      x: PLAYER_SPAWN_CELL[0] * CELL_SIZE,
      y: PLAYER_SPAWN_CELL[1] * CELL_SIZE,
      direction: Direction.UP,
      enemyKind: null,
    })
    tank.star = previousStar
    tank.shieldTicks = RESPAWN_SHIELD_TICKS
    this.player = tank
  }

  /** 玩家阵亡：扣生命并安排重生，生命耗尽则判定失败 */
  onPlayerDestroyed(): void {
    this.addExplosion(this.player, true)
    this.player = null
    this.playerLives -= 1

    if (this.playerLives <= 0) {
      this.outcome = LevelOutcome.FAILED
      return
    }
    this.respawnDelayTicks = SPAWN_BLINK_TICKS
  }

  /** 基地被击毁：直接判定失败 */
  onBaseDestroyed(): void {
    this.base.destroy()
    const rect = this.base.getRect()
    this.explosions.push(new Explosion(rect.x + rect.width / 2, rect.y + rect.height / 2, true))
    this.outcome = LevelOutcome.FAILED
  }

  private addExplosion(tank: Tank | null, big: boolean): void {
    if (tank === null) {
      return
    }
    const rect = tank.getRect()
    this.explosions.push(new Explosion(rect.x + rect.width / 2, rect.y + rect.height / 2, big))
  }

  /** 在指定像素中心添加爆炸 */
  addExplosionAt(centerX: number, centerY: number, big: boolean): void {
    this.explosions.push(new Explosion(centerX, centerY, big))
  }

  addScore(amount: number): void {
    this.score += amount
    if (this.score > this.highScore) {
      this.highScore = this.score
    }
  }

  /** 移除所有已死亡的实体。每帧末统一执行，避免遍历中修改数组。 */
  removeDeadEntities(): void {
    this.enemies = this.enemies.filter((tank) => tank.alive)
    this.bullets = this.bullets.filter((bullet) => bullet.alive)
    this.powerUps = this.powerUps.filter((powerUp) => powerUp.alive)
    this.explosions = this.explosions.filter((explosion) => explosion.alive)
  }

  /** 全部敌人被消灭且无待出场敌人 → 过关 */
  checkLevelCleared(): void {
    if (this.outcome !== LevelOutcome.ONGOING) {
      return
    }
    if (this.pendingEnemies.length === 0 && this.enemies.length === 0) {
      this.outcome = LevelOutcome.CLEARED
    }
  }
}
