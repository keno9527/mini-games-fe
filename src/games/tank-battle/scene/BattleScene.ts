import {
  ENEMIES_PER_LEVEL,
  FIELD_PIXELS,
  LEVEL_CLEAR_TICKS,
  LEVEL_INTRO_TICKS,
} from '@/games/tank-battle/constants.ts'
import type { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { LEVELS } from '@/games/tank-battle/data/levels.ts'
import { drawCenteredBanner, drawCurtain, drawDimOverlay } from '@/games/tank-battle/render/Hud.ts'
import { COLORS } from '@/games/tank-battle/render/palette.ts'
import { renderBattlefield } from '@/games/tank-battle/render/renderBattlefield.ts'
import { updateBullets } from '@/games/tank-battle/system/BulletSystem.ts'
import { updateEnemyAi } from '@/games/tank-battle/system/EnemyAiSystem.ts'
import { updatePlayer } from '@/games/tank-battle/system/PlayerController.ts'
import { updatePowerUps, updatePowerUpTimers } from '@/games/tank-battle/system/PowerUpSystem.ts'
import { updateSpawning } from '@/games/tank-battle/system/SpawnManager.ts'
import { LevelOutcome, type World } from '@/games/tank-battle/system/World.ts'
import { SoundEffect, type InputSnapshot } from '@/games/tank-battle/types.ts'
import type { Scene } from '@/games/tank-battle/scene/Scene.ts'

/** 战斗场景内部阶段 */
enum BattlePhase {
  INTRO = 'intro',
  FIGHTING = 'fighting',
  PAUSED = 'paused',
  LEVEL_CLEAR = 'levelClear',
}

interface BattleSceneCallbacks {
  /** 全部关卡通关或玩家失败时通知外层切场景 */
  readonly onGameOver: (victory: boolean) => void
}

/**
 * 战斗场景：驱动一关的完整生命周期。
 *
 * 单个 tick 内 system 的执行顺序本身即是规则的一部分，不可随意调换：
 *   玩家输入 → 敌方 AI → 子弹推进与碰撞 → 道具 → 生成 → 计时器 → 清理 → 判定
 */
export class BattleScene implements Scene {
  private readonly world: World
  private readonly audio: AudioEngine
  private readonly callbacks: BattleSceneCallbacks

  private phase: BattlePhase = BattlePhase.INTRO
  private phaseTicks = 0
  /** 水面波纹等环境动画的相位，与逻辑帧同步递增 */
  private animationPhase = 0

  constructor(world: World, audio: AudioEngine, callbacks: BattleSceneCallbacks) {
    this.world = world
    this.audio = audio
    this.callbacks = callbacks
  }

  onEnter(): void {
    this.startLevel(this.world.levelIndex)
  }

  /** 载入指定关卡并进入开场阶段 */
  startLevel(levelIndex: number): void {
    this.world.loadLevel(levelIndex)
    this.phase = BattlePhase.INTRO
    this.phaseTicks = LEVEL_INTRO_TICKS
    this.audio.play(SoundEffect.LEVEL_START)
  }

  update(input: InputSnapshot): void {
    this.animationPhase += 1

    switch (this.phase) {
      case BattlePhase.INTRO:
        this.updateIntro()
        break

      case BattlePhase.FIGHTING:
        this.updateFighting(input)
        break

      case BattlePhase.PAUSED:
        if (input.pauseEdge) {
          this.phase = BattlePhase.FIGHTING
        }
        break

      case BattlePhase.LEVEL_CLEAR:
        this.updateLevelClear()
        break

      default:
        break
    }
  }

  private updateIntro(): void {
    this.phaseTicks -= 1
    if (this.phaseTicks <= 0) {
      this.phase = BattlePhase.FIGHTING
    }
  }

  private updateFighting(input: InputSnapshot): void {
    if (input.pauseEdge) {
      this.phase = BattlePhase.PAUSED
      return
    }

    const playSound = (effect: SoundEffect): void => {
      this.audio.play(effect)
    }

    updatePlayer(this.world, input, playSound)
    updateEnemyAi(this.world)
    updateBullets(this.world, playSound)
    updatePowerUps(this.world, playSound)
    updateSpawning(this.world)
    updatePowerUpTimers(this.world)

    this.tickEntityTimers()
    this.world.removeDeadEntities()
    this.world.checkLevelCleared()

    this.handleOutcome()
  }

  /** 推进所有实体的自有计时器 */
  private tickEntityTimers(): void {
    this.world.player?.tickTimers()
    for (const enemy of this.world.enemies) {
      enemy.tickTimers()
    }
    for (const explosion of this.world.explosions) {
      explosion.tickTimers()
    }
  }

  private handleOutcome(): void {
    if (this.world.outcome === LevelOutcome.CLEARED) {
      this.phase = BattlePhase.LEVEL_CLEAR
      this.phaseTicks = LEVEL_CLEAR_TICKS
      return
    }

    if (this.world.outcome === LevelOutcome.FAILED) {
      this.audio.play(SoundEffect.GAME_OVER)
      this.callbacks.onGameOver(false)
    }
  }

  private updateLevelClear(): void {
    this.phaseTicks -= 1
    if (this.phaseTicks > 0) {
      return
    }

    const nextLevel = this.world.levelIndex + 1
    if (nextLevel >= LEVELS.length) {
      this.callbacks.onGameOver(true)
      return
    }
    this.startLevel(nextLevel)
  }

  render(context: CanvasRenderingContext2D): void {
    renderBattlefield(context, this.world, Math.floor(this.animationPhase / 8))

    switch (this.phase) {
      case BattlePhase.INTRO: {
        // 横幕由外向内拉开，进度 0 → 1
        const progress = 1 - this.phaseTicks / LEVEL_INTRO_TICKS
        drawCurtain(context, progress)
        drawCenteredBanner(context, [`STAGE ${this.world.levelIndex + 1}`], COLORS.TEXT_PRIMARY)
        break
      }

      case BattlePhase.PAUSED:
        drawDimOverlay(context, 0.5)
        drawCenteredBanner(context, ['PAUSE'], COLORS.TEXT_HIGHLIGHT)
        break

      case BattlePhase.LEVEL_CLEAR:
        drawDimOverlay(context, 0.6)
        drawCenteredBanner(
          context,
          [
            `STAGE ${this.world.levelIndex + 1} CLEAR`,
            `KILLED ${this.world.enemiesKilled} OF ${ENEMIES_PER_LEVEL}`,
            `SCORE ${this.world.score}`,
          ],
          COLORS.TEXT_PRIMARY,
        )
        break

      default:
        break
    }
  }

  /** 战场逻辑宽高，供外层布局使用 */
  static getFieldSize(): number {
    return FIELD_PIXELS
  }

  isPaused(): boolean {
    return this.phase === BattlePhase.PAUSED
  }
}
