import {
  CELL_SIZE,
  ENEMIES_PER_LEVEL,
  PLAYER_INITIAL_LIVES,
  RESPAWN_SHIELD_TICKS,
  SPAWN_BLINK_TICKS,
} from '@/games/tank-battle/constants.ts'
import { Rng } from '@/games/tank-battle/core/rng.ts'
import { BASE_CELL, PLAYER_SPAWN_CELLS } from '@/games/tank-battle/data/levels.ts'
import { CAMPAIGNS, type CampaignId } from '@/games/tank-battle/data/campaigns.ts'
import { Base } from '@/games/tank-battle/entity/Base.ts'
import type { Bullet } from '@/games/tank-battle/entity/Bullet.ts'
import { Explosion } from '@/games/tank-battle/entity/Explosion.ts'
import type { PowerUp } from '@/games/tank-battle/entity/PowerUp.ts'
import { Tank } from '@/games/tank-battle/entity/Tank.ts'
import { Direction, TankSide, EnemyKind, type LevelData } from '@/games/tank-battle/types.ts'
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
export interface PlayerState {
  tank: Tank | null
  lives: number
  respawnDelayTicks: number
}

export class World {
  private readonly customLevel?: LevelData
  readonly terrain: TerrainGrid
  readonly base = new Base()
  readonly rng: Rng

  readonly players: PlayerState[]
  enemies: Tank[] = []
  bullets: Bullet[] = []
  powerUps: PowerUp[] = []
  explosions: Explosion[] = []

  levelIndex = 0
  score = 0
  highScore = 0

  /** 本关剩余未出场的敌方队列 */
  pendingEnemies: EnemyKind[] = []
  /** 本关已被击毁的敌方数量 */
  enemiesKilled = 0
  stageKills: Record<EnemyKind, number> = { basic: 0, fast: 0, power: 0, armor: 0 }
  private bonusLifeAwarded = false

  /** 敌方冻结剩余帧数（计时器道具） */
  freezeTicks = 0
  /** 铲子道具剩余帧数 */
  shovelTicks = 0
  /** 距下一次敌方生成的剩余帧数 */
  spawnCountdownTicks = 0
  /** 下一个生成点的轮转索引 */
  nextSpawnPointIndex = 0

  outcome: LevelOutcome = LevelOutcome.ONGOING

  constructor(
    seed: number,
    initialHighScore = 0,
    playerCount: 1 | 2 = 1,
    customLevel?: LevelData,
    readonly campaignId: CampaignId = 'battle-city',
  ) {
    this.customLevel = customLevel
      ? { terrain: [...customLevel.terrain], enemyQueue: [...customLevel.enemyQueue] }
      : undefined
    this.players = Array.from({ length: playerCount }, () => ({
      tank: null,
      lives: PLAYER_INITIAL_LIVES,
      respawnDelayTicks: 0,
    }))
    this.rng = new Rng(seed)
    this.terrain = new TerrainGrid((this.customLevel ?? CAMPAIGNS[campaignId].levels[0]).terrain)
    this.highScore = initialHighScore
  }

  get levelCount(): number {
    return this.customLevel ? 1 : CAMPAIGNS[this.campaignId].levels.length
  }

  /** 本关剩余敌方总数（未出场 + 场上存活） */
  getEnemiesRemaining(): number {
    return this.pendingEnemies.length + this.enemies.length
  }

  /** 载入指定关卡并重置战场（保留分数与生命） */
  loadLevel(levelIndex: number): void {
    const clampedIndex = levelIndex % this.levelCount
    this.levelIndex = levelIndex

    const level = this.customLevel ?? CAMPAIGNS[this.campaignId].levels[clampedIndex]
    this.terrain.load(level.terrain)
    // The original base drawing pass replaces map tiles at the eagle's position.
    // Shifted Tank A layouts can contain walls/trees here before that pass.
    this.terrain.clearSpawnCell(...BASE_CELL)
    this.base.reset()

    this.enemies = []
    this.bullets = []
    this.powerUps = []
    this.explosions = []

    this.pendingEnemies = [...level.enemyQueue].slice(0, ENEMIES_PER_LEVEL)
    this.enemiesKilled = 0
    this.stageKills = { basic: 0, fast: 0, power: 0, armor: 0 }

    this.freezeTicks = 0
    this.shovelTicks = 0
    this.spawnCountdownTicks = 0
    this.nextSpawnPointIndex = 0
    this.outcome = LevelOutcome.ONGOING

    this.players.forEach((player, slot) => {
      player.respawnDelayTicks = 0
      if (player.lives > 0) this.spawnPlayer(true, slot)
    })
  }

  /** 在出生点放置玩家坦克。keepStar 为 false 时星级归零（阵亡后降级）。 */
  spawnPlayer(keepStar: boolean, slot = 0): void {
    const player = this.players[slot]
    if (!player || player.lives <= 0) return
    const previousStar = keepStar ? (player.tank?.star ?? 0) : 0
    const spawn = PLAYER_SPAWN_CELLS[slot]
    const tank = new Tank({
      side: TankSide.PLAYER,
      x: spawn[0] * CELL_SIZE,
      y: spawn[1] * CELL_SIZE,
      direction: Direction.UP,
      enemyKind: null,
    })
    tank.star = previousStar
    tank.shieldTicks = RESPAWN_SHIELD_TICKS
    this.terrain.clearSpawnCell(...spawn)
    tank.playerSlot = slot
    player.tank = tank
  }

  /** 每名玩家独立扣生命；全部耗尽才失败。 */
  onPlayerDestroyed(slot = 0): void {
    const player = this.players[slot]
    if (!player?.tank) return
    this.addExplosion(player.tank, true)
    player.tank = null
    player.lives = Math.max(0, player.lives - 1)
    player.respawnDelayTicks = player.lives > 0 ? SPAWN_BLINK_TICKS : 0
    if (this.players.every((entry) => entry.lives <= 0)) this.outcome = LevelOutcome.FAILED
  }

  getPlayerTanks(): Tank[] {
    return this.players.flatMap((player) => (player.tank?.alive ? [player.tank] : []))
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
    if (!this.bonusLifeAwarded && this.score >= 20000) {
      for (const player of this.players) {
        if (player.lives > 0) player.lives += 1
      }
      this.bonusLifeAwarded = true
    }
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
