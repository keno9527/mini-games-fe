import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Pause,
  Play,
} from '@phosphor-icons/react'
import { createRecord, getUserStats } from '@/api'
import type { GameComponentProps } from '@/games/manifest'
import {
  mountTankBattle,
  type TankBattleHandle,
  type TankBattleUiState,
  type TankBattleControllers,
} from '@/games/tank-battle/runtime.ts'
import type { TankBattleHoldAction } from '@/games/tank-battle/types.ts'
import type { PlayerCount, PlayerSlot } from '@/features/gamepad/players.ts'
import './tank-battle.css'

export default function TankBattle({ userId, gameId }: GameComponentProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<TankBattleHandle | null>(null)
  const [ready, setReady] = useState(false)
  const [uiState, setUiState] = useState<TankBattleUiState>('title')
  const [playerCount, setPlayerCount] = useState<PlayerCount>(1)
  const [controllers, setControllers] = useState<TankBattleControllers>({
    snapshot: { status: 'waiting', devices: [] },
    bindings: [null, null],
    canPlay: true,
  })

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
        onControllersChange: setControllers,
        onGameOver: (result) => {
          if (!userId) return
          createRecord(userId, {
            gameId,
            score: result.score,
            duration: result.duration,
            result: result.victory ? 'win' : 'lose',
          }).catch(() => {})
        },
      })
      gameRef.current = game
      setPlayerCount(1)
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
      <div className="tank-controller-setup">
        <div className="tank-mode-row">
          <fieldset disabled={!ready || inBattle}>
            <legend>游玩人数</legend>
            {([1, 2] as const).map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={playerCount === count}
                onClick={() => {
                  gameRef.current?.setPlayerCount(count)
                  setPlayerCount(count)
                }}
              >
                {count === 1 ? '单人作战' : '双人合作'}
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            className="tank-session-action"
            disabled={!ready || !controllers.canPlay}
            onClick={() => {
              if (inBattle) gameRef.current?.togglePause()
              else gameRef.current?.confirm()
            }}
          >
            {uiState === 'paused'
              ? '继续游戏'
              : inBattle
                ? '暂停游戏'
                : uiState === 'gameOver'
                  ? '重新挑战'
                  : '开始游戏'}
          </button>
        </div>
        <div className="tank-player-bindings">
          {Array.from({ length: playerCount }, (_, slot) => (
            <label key={slot}>
              <span className={slot === 0 ? 'tank-player-one' : 'tank-player-two'}>
                P{slot + 1} · {slot === 0 ? '金色坦克' : '蓝色坦克'}
              </span>
              <select
                aria-label={`P${slot + 1} 手柄`}
                disabled={!ready || uiState === 'playing'}
                value={
                  controllers.bindings[slot] ??
                  (playerCount === 1 && !controllers.canPlay ? 'disconnected' : '')
                }
                onChange={(event) => {
                  gameRef.current?.bindGamepad(
                    slot as PlayerSlot,
                    event.target.value === '' ? null : Number(event.target.value),
                  )
                }}
              >
                {playerCount === 1 &&
                  !controllers.canPlay &&
                  controllers.bindings[slot] === null && (
                    <option value="disconnected" disabled>
                      手柄已断开，请重选或切回键盘 / 触控
                    </option>
                  )}
                {controllers.bindings[slot] !== null &&
                  !controllers.snapshot.devices.some(
                    (device) => device.index === controllers.bindings[slot],
                  ) && (
                    <option value={controllers.bindings[slot]!} disabled>
                      #{controllers.bindings[slot]} · 暂停读取
                    </option>
                  )}
                <option value="">
                  {playerCount === 1 ? '键盘 / 触控（或选择手柄）' : '请选择手柄'}
                </option>
                {controllers.snapshot.devices.map((device) => (
                  <option
                    key={device.index}
                    value={device.index}
                    disabled={
                      device.mapping !== 'standard' ||
                      controllers.bindings.some(
                        (index, other) => other !== slot && index === device.index,
                      )
                    }
                  >
                    #{device.index} · {device.id || '未命名手柄'}
                    {device.mapping !== 'standard' ? '（暂不支持此映射）' : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p role="status">
          {!controllers.canPlay
            ? '请连接并分配所需手柄，再开始或继续游戏；断连后需重新选择。'
            : playerCount === 2
              ? '两人合作守基地，各有 3 条初始生命；一人出局后队友可继续。共享得分，队友之间无伤害。'
              : '单人可使用手柄、键盘或触控。'}
        </p>
        <details className="tank-controls-guide">
          <summary>连接与操作说明</summary>
          <p>
            连接后按一下手柄按钮让设备出现，再选择 P1 / P2。方向键 / 左摇杆移动，A / × 或 RT / R2
            开火，A / × 开始，Menu / Options 暂停。
          </p>
          <p>
            绑定或返回页面后先松开手柄按键和摇杆，再操作。键盘与触控控制
            P1；双人模式需两个标准映射手柄。基地仍会受到己方炮火伤害。
          </p>
        </details>
        {controllers.snapshot.status === 'insecure' && <p>手柄需要 HTTPS 或 localhost 地址。</p>}
        {controllers.snapshot.status === 'unsupported' && (
          <p>此浏览器未提供 Gamepad API；单人仍可使用键盘或触控。</p>
        )}
        {controllers.snapshot.status === 'error' && (
          <p>手柄读取失败，请检查浏览器权限；恢复后手动继续。</p>
        )}
      </div>
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
        <p className="tank-keyboard-help">开始 / 开火：空格 / J · 暂停：P / Esc</p>
        <p className="tank-touch-help">左侧方向键移动，右侧按键开火</p>
      </div>
      <div className="tank-touch-controls" aria-label="坦克大战触控操作">
        {!inBattle ? (
          <button
            type="button"
            className="tank-touch-start"
            disabled={!ready || !controllers.canPlay}
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
                disabled={uiState === 'paused' || !controllers.canPlay}
                onAction={setHeldAction}
              >
                <ArrowUp size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
              <HoldButton
                action="left"
                label="向左移动"
                disabled={uiState === 'paused' || !controllers.canPlay}
                onAction={setHeldAction}
              >
                <ArrowLeft size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
              <HoldButton
                action="down"
                label="向下移动"
                disabled={uiState === 'paused' || !controllers.canPlay}
                onAction={setHeldAction}
              >
                <ArrowDown size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
              <HoldButton
                action="right"
                label="向右移动"
                disabled={uiState === 'paused' || !controllers.canPlay}
                onAction={setHeldAction}
              >
                <ArrowRight size={28} weight="bold" aria-hidden="true" />
              </HoldButton>
            </div>
            <div className="tank-touch-actions">
              <HoldButton
                action="fire"
                label="持续开火"
                disabled={uiState === 'paused' || !controllers.canPlay}
                onAction={setHeldAction}
                fire
              >
                <Crosshair size={34} weight="bold" aria-hidden="true" />
                <span>开火</span>
              </HoldButton>
              <button
                type="button"
                className="tank-touch-pause"
                disabled={!controllers.canPlay}
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
