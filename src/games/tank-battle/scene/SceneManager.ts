import { LEVELS } from '@/games/tank-battle/data/levels.ts'
import { PLAYER_INITIAL_LIVES } from '@/games/tank-battle/constants.ts'
import type { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { resetEntityIds } from '@/games/tank-battle/core/ids.ts'
import { World } from '@/games/tank-battle/system/World.ts'
import { SceneKind, type InputSnapshot } from '@/games/tank-battle/types.ts'
import { BattleScene } from '@/games/tank-battle/scene/BattleScene.ts'
import { GameOverScene } from '@/games/tank-battle/scene/GameOverScene.ts'
import type { Scene } from '@/games/tank-battle/scene/Scene.ts'
import { TitleScene } from '@/games/tank-battle/scene/TitleScene.ts'

export interface TankBattleResult {
  readonly practice: boolean
  readonly victory: boolean
  readonly score: number
  readonly highScore: number
  readonly levelReached: number
  readonly duration: number
}

export interface SceneManagerOptions {
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
  private readonly audio: AudioEngine
  private readonly onGameOver?: (result: TankBattleResult) => void
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

  constructor(audio: AudioEngine, seed: number, options: SceneManagerOptions = {}) {
    this.audio = audio
    this.onGameOver = options.onGameOver
    this.world = new World(seed, options.initialHighScore)
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
    }))

    this.battleScene = this.createBattleScene()

    this.current = this.titleScene
    this.current.onEnter()
  }

  private createBattleScene(): BattleScene {
    return new BattleScene(this.world, this.audio, {
      onGameOver: (victory: boolean): void => this.finishGame(victory),
      practice: this.practiceStage !== null,
    })
  }

  /** 开始新一局：重置世界状态但保留最高分 */
  private startNewGame(): void {
    const highScore = this.practiceStage === null ? this.campaignHighScore : 0

    resetEntityIds()
    this.world = new World(Date.now() >>> 0, highScore)
    this.world.playerLives = PLAYER_INITIAL_LIVES
    this.world.score = 0
    this.world.levelIndex = this.practiceStage ?? 0
    this.runTicks = 0

    this.battleScene = this.createBattleScene()
    this.switchTo(SceneKind.BATTLE)
  }

  /** 战斗结束：快照战绩后切到结束画面 */
  private finishGame(victory: boolean): void {
    if (this.practiceStage === null) this.campaignHighScore = this.world.highScore
    this.finalVictory = victory
    this.finalScore = this.world.score
    this.finalHighScore = this.world.highScore
    this.finalLevel = this.world.levelIndex + 1
    this.onGameOver?.({
      practice: this.practiceStage !== null,
      victory,
      score: this.finalScore,
      highScore: this.finalHighScore,
      levelReached: this.finalLevel,
      duration: Math.max(1, Math.round(this.runTicks / 60)),
    })
    this.switchTo(SceneKind.GAME_OVER)
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
    if (!this.isPaused()) return
    this.audio.stopAll()
    this.switchTo(SceneKind.TITLE)
  }

  setPracticeStage(stage: number | null): void {
    if (this.currentKind === SceneKind.BATTLE) return
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
