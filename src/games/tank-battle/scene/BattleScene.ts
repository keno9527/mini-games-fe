import {
  FIELD_PIXELS,
  FIELD_OFFSET_X,
  FIELD_OFFSET_Y,
  LEVEL_CLEAR_TICKS,
  LEVEL_INTRO_TICKS,
} from '@/games/tank-battle/constants.ts'
import type { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { ENEMY_SPECS } from '@/games/tank-battle/data/tankSpecs.ts'
import { drawText } from '@/games/tank-battle/render/drawSprites.ts'
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
import { EnemyKind, SoundEffect, type InputSnapshot } from '@/games/tank-battle/types.ts'
import type { Scene } from '@/games/tank-battle/scene/Scene.ts'

/** 战斗场景内部阶段 */
enum BattlePhase {
  INTRO = 'intro',
  FIGHTING = 'fighting',
  PAUSED = 'paused',
  LEVEL_CLEAR = 'levelClear',
}

interface BattleSceneCallbacks {
  readonly practice?: boolean
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
  private resumePhase = BattlePhase.FIGHTING
  private elapsedTicks = 0
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
    this.audio.stopAll()
    this.audio.play(SoundEffect.LEVEL_START)
  }

  update(input: InputSnapshot): void {
    if (input.pauseEdge) {
      this.audio.stopAll()
      if (this.phase === BattlePhase.PAUSED) this.phase = this.resumePhase
      else {
        this.resumePhase = this.phase
        this.phase = BattlePhase.PAUSED
      }
      this.audio.play(SoundEffect.PAUSE)
      return
    }
    if (this.phase === BattlePhase.PAUSED) return
    this.animationPhase += 1

    switch (this.phase) {
      case BattlePhase.INTRO:
        this.updateIntro()
        break

      case BattlePhase.FIGHTING:
        this.updateFighting(input)
        break

      case BattlePhase.LEVEL_CLEAR:
        this.updateLevelClear(input)
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
    const playSound = (effect: SoundEffect): void => {
      this.audio.play(effect)
    }

    this.elapsedTicks += 1
    const previousLives = this.world.playerLives
    updatePlayer(this.world, input, playSound)
    updateEnemyAi(this.world)
    updateBullets(this.world, playSound)
    updatePowerUps(this.world, playSound)
    updateSpawning(this.world)
    updatePowerUpTimers(this.world)

    this.tickEntityTimers()
    this.world.removeDeadEntities()
    this.world.checkLevelCleared()

    if (this.world.playerLives > previousLives) this.audio.play(SoundEffect.EXTRA_LIFE)
    if (this.world.player?.moving && this.elapsedTicks % 6 === 0) this.audio.play(SoundEffect.MOTOR)
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
      this.audio.stopAll()
      this.phase = BattlePhase.LEVEL_CLEAR
      this.phaseTicks = LEVEL_CLEAR_TICKS
      return
    }

    if (this.world.outcome === LevelOutcome.FAILED) {
      this.audio.play(SoundEffect.GAME_OVER)
      this.callbacks.onGameOver(false)
    }
  }

  private updateLevelClear(input: InputSnapshot): void {
    this.phaseTicks -= 1
    const elapsed = LEVEL_CLEAR_TICKS - this.phaseTicks
    if (elapsed < 240 && elapsed % 8 === 0) this.audio.play(SoundEffect.SCORE_TICK)
    if (this.phaseTicks > 0 && !(elapsed > 240 && (input.confirmEdge || input.fire))) return

    const nextLevel = this.world.levelIndex + 1
    if (this.callbacks.practice || nextLevel >= LEVELS.length) {
      this.callbacks.onGameOver(true)
      return
    }
    this.startLevel(nextLevel)
  }

  render(context: CanvasRenderingContext2D): void {
    renderBattlefield(context, this.world, Math.floor(this.animationPhase / 8))

    context.save()
    context.translate(FIELD_OFFSET_X, FIELD_OFFSET_Y)
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

      case BattlePhase.LEVEL_CLEAR: {
        drawDimOverlay(context, 0.92)
        drawText(context, `STAGE ${this.world.levelIndex + 1} CLEAR`, 46, 24, COLORS.TEXT_HIGHLIGHT)
        drawText(context, 'TYPE    KILLS     PTS', 30, 48, COLORS.TEXT_PRIMARY)
        const elapsed = LEVEL_CLEAR_TICKS - this.phaseTicks
        const kinds = [EnemyKind.BASIC, EnemyKind.FAST, EnemyKind.POWER, EnemyKind.ARMOR]
        kinds.forEach((kind, index) => {
          const count = Math.min(
            this.world.stageKills[kind],
            Math.max(0, Math.floor((elapsed - index * 45) / 4)),
          )
          const label = ['BASIC', 'FAST ', 'POWER', 'ARMOR'][index]
          drawText(
            context,
            `${label}    ${String(count).padStart(2)}    ${String(count * ENEMY_SPECS[kind].score).padStart(4)}`,
            30,
            68 + index * 18,
            COLORS.TEXT_PRIMARY,
          )
        })
        drawText(
          context,
          `TOTAL ${this.world.enemiesKilled}   SCORE ${this.world.score}`,
          30,
          153,
          COLORS.TEXT_HIGHLIGHT,
        )
        drawText(
          context,
          elapsed > 240 ? 'ENTER / FIRE TO CONTINUE' : 'COUNTING...',
          30,
          178,
          COLORS.TEXT_PRIMARY,
        )
        break
      }

      default:
        break
    }
    context.restore()
  }

  /** 战场逻辑宽高，供外层布局使用 */
  static getFieldSize(): number {
    return FIELD_PIXELS
  }

  isPaused(): boolean {
    return this.phase === BattlePhase.PAUSED
  }
}
