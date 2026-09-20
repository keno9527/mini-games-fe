import type { AudioEngine } from '@/games/tank-battle/core/AudioEngine.ts'
import { resetEntityIds } from '@/games/tank-battle/core/ids.ts'
import { World } from '@/games/tank-battle/system/World.ts'
import { SceneKind, type InputSnapshot } from '@/games/tank-battle/types.ts'
import { BattleScene } from '@/games/tank-battle/scene/BattleScene.ts'
import { GameOverScene } from '@/games/tank-battle/scene/GameOverScene.ts'
import type { Scene } from '@/games/tank-battle/scene/Scene.ts'
import { TitleScene } from '@/games/tank-battle/scene/TitleScene.ts'

export interface TankBattleResult {
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
  private world: World
  private runStartedAtMs = Date.now()

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
    this.audio = audio
    this.onGameOver = options.onGameOver
    this.world = new World(seed, options.initialHighScore)

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
    })
  }

  /** 开始新一局：重置世界状态但保留最高分 */
  private startNewGame(): void {
    const highScore = this.world.highScore

    resetEntityIds()
    this.world = new World(Date.now() >>> 0, highScore, this.playerCount)
    this.world.score = 0
    this.world.levelIndex = 0
    this.runStartedAtMs = Date.now()

    this.battleScene = this.createBattleScene()
    this.switchTo(SceneKind.BATTLE)
  }

  /** 战斗结束：快照战绩后切到结束画面 */
  private finishGame(victory: boolean): void {
    this.finalVictory = victory
    this.finalScore = this.world.score
    this.finalHighScore = this.world.highScore
    this.finalLevel = this.world.levelIndex + 1
    this.onGameOver?.({
      victory,
      score: this.finalScore,
      highScore: this.finalHighScore,
      levelReached: this.finalLevel,
      duration: Math.max(1, Math.round((Date.now() - this.runStartedAtMs) / 1000)),
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

  getCurrentKind(): SceneKind {
    return this.currentKind
  }

  isPaused(): boolean {
    return this.currentKind === SceneKind.BATTLE && this.battleScene.isPaused()
  }

  update(input: InputSnapshot): void {
    this.current.update(input)
  }

  render(context: CanvasRenderingContext2D): void {
    this.current.render(context)
  }
}
