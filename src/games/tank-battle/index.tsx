import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
} from '@phosphor-icons/react'
import { createRecord, getUserStats } from '@/api'
import type { GameComponentProps } from '@/games/manifest'
import {
  mountTankBattle,
  type TankBattleHandle,
  type TankBattleUiState,
} from '@/games/tank-battle/runtime.ts'
import { LEVELS } from '@/games/tank-battle/data/levels.ts'
import { POWERUP_SPRITES } from '@/games/tank-battle/data/sprites.ts'
import { POWERUP_PALETTE } from '@/games/tank-battle/render/palette.ts'
import { PowerUpKind, type TankBattleHoldAction } from '@/games/tank-battle/types.ts'
import './tank-battle.css'

export default function TankBattle({ userId, gameId }: GameComponentProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<TankBattleHandle | null>(null)
  const [ready, setReady] = useState(false)
  const [uiState, setUiState] = useState<TankBattleUiState>('title')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [practiceStage, setPracticeStage] = useState('campaign')

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage) return

    let game: TankBattleHandle | undefined
    let cancelled = false

    const startGame = async () => {
      let initialHighScore = 0
      if (userId) {
        try {
          const stats = await getUserStats(userId)
          initialHighScore = stats.gameStats.find((stat) => stat.gameId === gameId)?.bestScore ?? 0
        } catch {
          // 战绩读取失败时从 0 开始，不影响游戏本体。
        }
      }

      if (cancelled) return
      game = mountTankBattle(canvas, stage, {
        initialHighScore,
        onStateChange: setUiState,
        onGameOver: (result) => {
          if (!userId || result.practice) return
          createRecord(userId, {
            gameId,
            score: result.score,
            duration: result.duration,
            result: result.victory ? 'win' : 'lose',
          }).catch(() => {})
        },
      })
      gameRef.current = game
      setReady(true)
    }

    void startGame()
    return () => {
      cancelled = true
      gameRef.current = null
      game?.destroy()
    }
  }, [gameId, userId])

  const setHeldAction = useCallback((action: TankBattleHoldAction, active: boolean) => {
    gameRef.current?.setHeldAction(action, active)
  }, [])
  const inBattle = uiState === 'playing' || uiState === 'paused'

  return (
    <section className="tank-battle-shell overflow-hidden rounded-lg border-4 border-[#4d4d4d] bg-black shadow-[0_8px_0_#050505]">
      <div className="tank-toolbar">
        <div className="tank-mode">
          <span className="tank-eyebrow">BATTLE CITY · 1985</span>
          <label>
            <span className="sr-only">战役或关卡练习</span>
            <select
              aria-label="战役或关卡练习"
              disabled={!ready || inBattle}
              value={practiceStage}
              onChange={(event) => {
                setPracticeStage(event.target.value)
                gameRef.current?.setPracticeStage(
                  event.target.value === 'campaign' ? null : Number(event.target.value),
                )
              }}
            >
              <option value="campaign">经典战役 · 35 关</option>
              {LEVELS.map((_, index) => (
                <option key={index} value={index}>
                  关卡练习 · 第 {index + 1} 关
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tank-toolbar-actions">
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              if (inBattle) gameRef.current?.togglePause()
              else gameRef.current?.confirm()
              canvasRef.current?.focus({ preventScroll: true })
            }}
          >
            {uiState === 'playing' ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} aria-hidden="true" />
            )}
            {uiState === 'playing'
              ? '暂停'
              : uiState === 'paused'
                ? '继续'
                : uiState === 'gameOver'
                  ? '再来一局'
                  : '开始游戏'}
          </button>
          <button
            type="button"
            aria-label={soundEnabled ? '关闭音效' : '开启音效'}
            aria-pressed={soundEnabled}
            disabled={!ready}
            onClick={() => {
              gameRef.current?.setSoundEnabled(!soundEnabled)
              setSoundEnabled(!soundEnabled)
            }}
          >
            {soundEnabled ? (
              <SpeakerHigh size={18} aria-hidden="true" />
            ) : (
              <SpeakerSlash size={18} aria-hidden="true" />
            )}
            {soundEnabled ? '音效开' : '静音'}
          </button>
          {uiState === 'paused' && (
            <button type="button" onClick={() => gameRef.current?.returnToTitle()}>
              返回标题
            </button>
          )}
        </div>
      </div>
      {practiceStage !== 'campaign' && (
        <p className="tank-practice-note">单关练习 · 三条生命 · 战绩不计入排行榜</p>
      )}
      <div
        ref={stageRef}
        className="tank-battle-stage flex min-h-[240px] w-full items-center justify-center overflow-auto bg-black p-3 md:p-5"
      >
        <canvas
          ref={canvasRef}
          tabIndex={0}
          className="tank-battle-canvas block max-w-none [image-rendering:pixelated]"
          aria-label="坦克大战游戏画布"
        />
      </div>
      <div className="tank-battle-help grid gap-2 border-t-2 border-[#343434] bg-[#111] px-4 py-3 font-mono-crt text-sm tracking-wide text-[#d8d8d8] md:grid-cols-2">
        <p className="tank-keyboard-help">移动：方向键 / WASD</p>
        <p className="tank-keyboard-help">开始：Enter · 开火：空格 / J · 暂停：P / Esc</p>
        <p className="tank-touch-help">左侧方向键移动，右侧按键开火</p>
      </div>
      <div className="tank-touch-controls" aria-label="坦克大战触控操作">
        {!inBattle ? (
          <button
            type="button"
            className="tank-touch-start"
            disabled={!ready}
            onClick={() => gameRef.current?.confirm()}
          >
            <Play size={24} weight="fill" aria-hidden="true" />
            {uiState === 'gameOver' ? '重新挑战' : '开始游戏'}
          </button>
        ) : (
          <>
            <div className="tank-touch-dpad" aria-label="移动方向">
              <HoldButton
                action="up"
                label="向上移动"
                disabled={uiState === 'paused'}
                onAction={setHeldAction}
              >
                <ArrowUp size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
              <HoldButton
                action="left"
                label="向左移动"
                disabled={uiState === 'paused'}
                onAction={setHeldAction}
              >
                <ArrowLeft size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
              <HoldButton
                action="down"
                label="向下移动"
                disabled={uiState === 'paused'}
                onAction={setHeldAction}
              >
                <ArrowDown size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
              <HoldButton
                action="right"
                label="向右移动"
                disabled={uiState === 'paused'}
                onAction={setHeldAction}
              >
                <ArrowRight size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
            </div>
            <div className="tank-touch-actions">
              <HoldButton
                action="fire"
                label="持续开火"
                disabled={uiState === 'paused'}
                onAction={setHeldAction}
                fire
              >
                <Crosshair size={34} weight="bold" aria-hidden="true" />
                <span>开火</span>
              </HoldButton>
              <button
                type="button"
                className="tank-touch-pause"
                onClick={() => gameRef.current?.togglePause()}
              >
                {uiState === 'paused' ? (
                  <Play size={20} weight="fill" aria-hidden="true" />
                ) : (
                  <Pause size={20} weight="fill" aria-hidden="true" />
                )}
                {uiState === 'paused' ? '继续' : '暂停'}
              </button>
            </div>
          </>
        )}
      </div>
      <details className="tank-field-guide">
        <summary>道具与作战指南</summary>
        <p>守住老鹰，消灭每关 20 辆敌军。击中红色闪烁坦克会出现道具，拾取获得 500 分。</p>
        <div className="tank-powerup-guide">
          {[
            [POWERUP_SPRITES[PowerUpKind.STAR], '星星', '一星快弹、二星双发、三星破钢'],
            [POWERUP_SPRITES[PowerUpKind.HELMET], '头盔', '短暂无敌，闪烁护盾保护坦克'],
            [POWERUP_SPRITES[PowerUpKind.SHOVEL], '铲子', '重建基地钢墙，倒计时后恢复砖墙'],
            [POWERUP_SPRITES[PowerUpKind.TIMER], '时钟', '冻结敌方坦克，已发射的炮弹仍在飞行'],
            [POWERUP_SPRITES[PowerUpKind.GRENADE], '手雷', '清除已出场敌军，不增加击杀分'],
            [POWERUP_SPRITES[PowerUpKind.TANK], '坦克', '增加一条生命'],
          ].map(([icon, name, description]) => (
            <div key={name as string} className="tank-guide-item">
              <svg
                viewBox="0 0 16 16"
                width="32"
                height="32"
                aria-hidden="true"
                shapeRendering="crispEdges"
              >
                {(icon as readonly string[]).flatMap((row, y) =>
                  [...row].map((pixel, x) =>
                    POWERUP_PALETTE[pixel] ? (
                      <rect
                        key={`${x}-${y}`}
                        x={x}
                        y={y}
                        width="1"
                        height="1"
                        fill={POWERUP_PALETTE[pixel]}
                      />
                    ) : null,
                  ),
                )}
              </svg>
              <div>
                <strong>{name}</strong>
                <span>{description}</span>
              </div>
            </div>
          ))}
        </div>
        <p>
          草丛遮蔽坦克，水面阻挡移动，冰面产生滑行；普通炮弹破砖，三星炮弹破钢。阵亡后升级归零，过关保留升级。首次达到
          20,000 分奖励一条生命。
        </p>
      </details>
    </section>
  )
}

interface HoldButtonProps {
  action: TankBattleHoldAction
  label: string
  disabled: boolean
  onAction: (action: TankBattleHoldAction, active: boolean) => void
  children: ReactNode
  fire?: boolean
}

function HoldButton({
  action,
  label,
  disabled,
  onAction,
  children,
  fire = false,
}: HoldButtonProps) {
  const pointers = useRef(new Set<number>())
  const release = (pointerId: number) => {
    pointers.current.delete(pointerId)
    if (pointers.current.size === 0) onAction(action, false)
  }

  useEffect(() => {
    if (disabled) {
      pointers.current.clear()
      onAction(action, false)
    }
    return () => onAction(action, false)
  }, [action, disabled, onAction])

  return (
    <button
      type="button"
      className={fire ? 'tank-touch-fire' : `tank-touch-direction tank-touch-${action}`}
      aria-label={label}
      disabled={disabled}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault()
        pointers.current.add(event.pointerId)
        event.currentTarget.setPointerCapture(event.pointerId)
        onAction(action, true)
      }}
      onPointerUp={(event) => release(event.pointerId)}
      onPointerCancel={(event) => release(event.pointerId)}
      onLostPointerCapture={(event) => release(event.pointerId)}
    >
      {children}
    </button>
  )
}
