import { LEVELS } from '@/games/tank-battle/data/levels.ts'
import type { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { resetEntityIds } from '@/games/tank-battle/core/ids.ts'
import { World } from '@/games/tank-battle/system/World.ts'
import {
  SoundEffect,
  SceneKind,
  type LevelData,
  type InputSnapshot,
} from '@/games/tank-battle/types.ts'
import { BattleScene } from '@/games/tank-battle/scene/BattleScene.ts'
import { GameOverScene } from '@/games/tank-battle/scene/GameOverScene.ts'
import type { Scene } from '@/games/tank-battle/scene/Scene.ts'
import { isValidStage } from '../progress.ts'
import { TitleScene } from '@/games/tank-battle/scene/TitleScene.ts'

export interface TankBattleResult {
  readonly continued: boolean
  readonly practice: boolean
  readonly victory: boolean
  readonly score: number
  readonly highScore: number
  readonly levelReached: number
  readonly duration: number
}

export interface SceneManagerOptions {
  readonly onStageReached?: (stage: number) => void
  readonly customLevel?: LevelData
  readonly initialHighScore?: number
  readonly onGameOver?: (result: TankBattleResult) => void
}

/**
 * 场景状态机：标题 → 战斗 → 结束 → 标题。
 *
 * 场景切换的唯一入口是 switchTo()，其余场景通过回调请求切换而不直接互相引用，
 * 避免场景之间形成循环依赖。
 */
export class SceneManager {
  private readonly customLevel?: LevelData
  private readonly audio: AudioEngine
  private readonly onGameOver?: (result: TankBattleResult) => void
  private readonly onStageReached?: (stage: number) => void
  private startStage: number | null = null
  private continued = false
  private practiceStage: number | null = null
  private world: World
  private runTicks = 0
  private campaignHighScore = 0

  private readonly titleScene: TitleScene
  private readonly gameOverScene: GameOverScene
  private battleScene: BattleScene

  private current: Scene
  private currentKind: SceneKind = SceneKind.TITLE

  /** 结束画面需要展示的战绩，在切场景瞬间快照下来 */
  private finalVictory = false
  private finalScore = 0
  private finalHighScore = 0
  private finalLevel = 1
  private playerCount: 1 | 2 = 1

  setPlayerCount(count: 1 | 2): void {
    if (this.currentKind !== SceneKind.BATTLE) this.playerCount = count
  }

  suspend(): void {
    if (this.currentKind === SceneKind.BATTLE) this.battleScene.suspend()
  }

  constructor(audio: AudioEngine, seed: number, options: SceneManagerOptions = {}) {
    this.customLevel = options.customLevel
      ? {
          terrain: [...options.customLevel.terrain],
          enemyQueue: [...options.customLevel.enemyQueue],
        }
      : undefined
    this.audio = audio
    this.onGameOver = options.onGameOver
    this.onStageReached = options.onStageReached
    this.world = new World(
      seed,
      this.customLevel ? 0 : options.initialHighScore,
      this.playerCount,
      this.customLevel,
    )
    this.campaignHighScore = options.initialHighScore ?? 0

    this.titleScene = new TitleScene(
      { onStart: (): void => this.startNewGame() },
      (): number => this.world.highScore,
    )

    this.gameOverScene = new GameOverScene({ onRestart: (): void => this.startNewGame() }, () => ({
      victory: this.finalVictory,
      score: this.finalScore,
      highScore: this.finalHighScore,
      levelReached: this.finalLevel,
      canRetry: this.getRetryStage() !== null,
    }))

    this.battleScene = this.createBattleScene()

    this.current = this.titleScene
    this.current.onEnter()
  }

  private createBattleScene(): BattleScene {
    return new BattleScene(this.world, this.audio, {
      onGameOver: (victory: boolean): void => this.finishGame(victory),
      onLevelStart: (stage) => {
        if (this.isSingleCampaign()) this.onStageReached?.(stage)
      },
      practice: this.practiceStage !== null || this.customLevel !== undefined,
    })
  }

  /** 开始新一局：重置世界状态但保留最高分 */
  private startNewGame(): void {
    this.continued = this.isSingleCampaign() && this.startStage !== null
    const highScore = this.isRankedRun() ? this.campaignHighScore : 0

    resetEntityIds()
    this.world = new World(Date.now() >>> 0, highScore, this.playerCount, this.customLevel)
    this.world.score = 0
    this.world.levelIndex = this.practiceStage ?? (this.continued ? this.startStage! : 0)
    this.startStage = null
    this.runTicks = 0

    this.battleScene = this.createBattleScene()
    this.switchTo(SceneKind.BATTLE)
  }

  /** 战斗结束：快照战绩后切到结束画面 */
  private finishGame(victory: boolean): void {
    const newHighScore = this.isRankedRun() && this.world.score > this.campaignHighScore
    this.audio.setMotor(null)
    this.audio.playSequence([
      victory ? SoundEffect.VICTORY : SoundEffect.GAME_OVER,
      ...(newHighScore ? [SoundEffect.HIGH_SCORE] : []),
    ])
    if (this.isRankedRun()) this.campaignHighScore = this.world.highScore
    this.finalVictory = victory
    this.finalScore = this.world.score
    this.finalHighScore = this.world.highScore
    this.finalLevel = this.world.levelIndex + 1
    this.startStage = this.getRetryStage()
    this.onGameOver?.({
      continued: this.continued,
      practice: this.practiceStage !== null || this.customLevel !== undefined,
      victory,
      score: this.finalScore,
      highScore: this.finalHighScore,
      levelReached: this.finalLevel,
      duration: Math.max(1, Math.round(this.runTicks / 60)),
    })
    this.switchTo(SceneKind.GAME_OVER)
  }

  private isSingleCampaign(): boolean {
    return this.playerCount === 1 && this.practiceStage === null && !this.customLevel
  }

  private isRankedRun(): boolean {
    return this.practiceStage === null && !this.customLevel && !this.continued
  }

  isContinued(): boolean {
    return this.continued
  }

  getRetryStage(): number | null {
    return this.isSingleCampaign() && !this.finalVictory ? this.finalLevel - 1 : null
  }

  setStartStage(stage: number | null): void {
    if (this.currentKind === SceneKind.BATTLE) return
    this.startStage = this.isSingleCampaign() && isValidStage(stage) ? stage : null
  }

  switchTo(kind: SceneKind): void {
    this.currentKind = kind

    switch (kind) {
      case SceneKind.BATTLE:
        this.current = this.battleScene
        break
      case SceneKind.GAME_OVER:
        this.current = this.gameOverScene
        break
      default:
        this.current = this.titleScene
        break
    }

    this.current.onEnter()
  }

  returnToTitle(): void {
    if (!this.isPaused() && this.currentKind !== SceneKind.GAME_OVER) return
    this.audio.stopAll()
    this.startStage = null
    this.switchTo(SceneKind.TITLE)
  }

  setPracticeStage(stage: number | null): void {
    if (this.currentKind === SceneKind.BATTLE || this.customLevel) return
    this.practiceStage =
      stage === null ? null : Math.max(0, Math.min(LEVELS.length - 1, Math.floor(stage)))
  }

  getCurrentKind(): SceneKind {
    return this.currentKind
  }

  isPaused(): boolean {
    return this.currentKind === SceneKind.BATTLE && this.battleScene.isPaused()
  }

  update(input: InputSnapshot): void {
    if (this.currentKind === SceneKind.BATTLE && !this.isPaused() && !input.pauseEdge)
      this.runTicks += 1
    this.current.update(input)
  }

  render(context: CanvasRenderingContext2D): void {
    this.current.render(context)
  }
}
