import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  ArrowsOut,
  ArrowsIn,
  Question,
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
  type TankBattleControllers,
  type TankBattleMenu,
} from '@/games/tank-battle/runtime.ts'
import { TankMenu, TankPauseMenu } from './TankMenu.tsx'
import { POWERUP_SPRITES } from '@/games/tank-battle/data/sprites.ts'
import { POWERUP_PALETTE } from '@/games/tank-battle/render/palette.ts'
import { PowerUpKind, type TankBattleHoldAction } from '@/games/tank-battle/types.ts'
import { MapEditor, MapLibrary } from '@/games/tank-battle/editor/MapEditor.tsx'
import type { CustomMap } from '@/games/tank-battle/editor/maps.ts'
import './tank-battle.css'

export default function TankBattle(props: GameComponentProps) {
  const [view, setView] = useState<'game' | 'editor' | 'library' | 'test' | 'custom'>('game')
  const [editorMap, setEditorMap] = useState<CustomMap | undefined>()
  const [customMap, setCustomMap] = useState<CustomMap | undefined>()
  const openEditor = (map?: CustomMap) => {
    setEditorMap(map)
    setView('editor')
  }
  if (view === 'library')
    return (
      <MapLibrary
        onBack={() => setView('game')}
        onEdit={openEditor}
        onPlay={(map) => {
          setCustomMap(map)
          setView('custom')
        }}
      />
    )
  return (
    <>
      {(view === 'editor' || view === 'test') && (
        <div hidden={view !== 'editor'}>
          <MapEditor
            initialMap={editorMap}
            active={view === 'editor'}
            onBack={() => setView('game')}
            onLibrary={() => setView('library')}
            onPlay={(map) => {
              setCustomMap(map)
              setView('test')
            }}
          />
        </div>
      )}
      {view !== 'editor' && (
        <TankBattlePlayer
          key={view}
          {...props}
          customMap={view === 'test' || view === 'custom' ? customMap : undefined}
          onEditor={() => openEditor()}
          onLibrary={() => setView('library')}
          returnLabel={view === 'test' ? '返回编辑' : '返回我的地图'}
          onReturn={() => setView(view === 'test' ? 'editor' : 'library')}
        />
      )}
    </>
  )
}

interface PlayerProps extends GameComponentProps {
  customMap?: CustomMap
  onEditor: () => void
  onLibrary: () => void
  onReturn: () => void
  returnLabel: string
}
function TankBattlePlayer({
  userId,
  gameId,
  customMap,
  onEditor,
  onLibrary,
  onReturn,
  returnLabel,
}: PlayerProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLDialogElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<TankBattleHandle | null>(null)
  const customGameStarted = useRef(false)
  const [ready, setReady] = useState(false)
  const [uiState, setUiState] = useState<TankBattleUiState>('title')
  const [menu, setMenu] = useState<TankBattleMenu>({
    mode: 'single',
    page: 'modes',
    awaitingControllers: false,
    practiceStage: 0,
    pauseSelection: 0,
    soundEnabled: true,
  })
  const [controllers, setControllers] = useState<TankBattleControllers>({
    snapshot: { status: 'waiting', devices: [] },
    bindings: [null, null],
    canPlay: true,
  })
  const [fullscreen, setFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState('')
  const compactBattle = uiState !== 'title'

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
        customLevel: customMap,
        initialHighScore,
        onStateChange: setUiState,
        onControllersChange: setControllers,
        onMenuChange: setMenu,
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
      if (customMap) game.confirm()
    }

    void startGame()
    return () => {
      cancelled = true
      gameRef.current = null
      game?.destroy()
    }
  }, [gameId, userId, customMap])

  useLayoutEffect(() => {
    if (!ready) return
    gameRef.current?.setViewport(compactBattle ? frameRef.current : null)
    if (compactBattle) canvasRef.current?.focus({ preventScroll: true })
  }, [compactBattle, ready])

  useEffect(() => {
    if (!customMap) return
    if (compactBattle) customGameStarted.current = true
    else if (customGameStarted.current) onReturn()
  }, [compactBattle, customMap, onReturn])

  useEffect(() => {
    if (!compactBattle) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [compactBattle])

  useEffect(() => {
    if (!compactBattle && document.fullscreenElement === frameRef.current) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [compactBattle])

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current)
    document.addEventListener('fullscreenchange', updateFullscreen)
    return () => document.removeEventListener('fullscreenchange', updateFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    setFullscreenError('')
    try {
      if (document.fullscreenElement === frameRef.current) await document.exitFullscreen()
      else await frameRef.current?.requestFullscreen()
      canvasRef.current?.focus({ preventScroll: true })
    } catch {
      setFullscreenError('无法进入全屏，请继续使用当前窗口。')
    }
  }

  const returnToTitle = async () => {
    if (document.fullscreenElement === frameRef.current) {
      try {
        await document.exitFullscreen()
      } catch {
        // 返回标题仍可进行，浏览器也可通过 Esc 退出全屏。
      }
    }
    setFullscreenError('')
    gameRef.current?.returnToTitle()
  }

  const setHeldAction = useCallback((action: TankBattleHoldAction, active: boolean) => {
    gameRef.current?.setHeldAction(action, active)
  }, [])
  const inBattle = uiState === 'playing' || uiState === 'paused'

  return (
    <div
      ref={frameRef}
      className={`tank-player-frame${compactBattle ? ' tank-player-frame--battle' : ''}`}
    >
      <section
        className={`tank-battle-shell ${!compactBattle ? 'tank-battle-shell--title' : ''} overflow-hidden rounded-lg border-4 border-[#4d4d4d] bg-black shadow-[0_8px_0_#050505]`}
      >
        {compactBattle && (
          <div className="tank-toolbar" data-tank-chrome>
            <div className="tank-mode">
              <span className="tank-eyebrow">BATTLE CITY · 1985</span>
              {compactBattle && (
                <span className="tank-battle-mode-label">
                  {customMap
                    ? customMap.name
                    : menu.mode !== 'practice'
                      ? '经典战役'
                      : `关卡练习 · 第 ${menu.practiceStage + 1} 关`}
                </span>
              )}
            </div>
            <div className="tank-toolbar-actions">
              {customMap && <button onClick={onReturn}>{returnLabel}</button>}
              <button
                type="button"
                disabled={!ready || !controllers.canPlay}
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
                aria-label={menu.soundEnabled ? '关闭音效' : '开启音效'}
                aria-pressed={menu.soundEnabled}
                disabled={!ready}
                onClick={() => {
                  gameRef.current?.setSoundEnabled(!menu.soundEnabled)
                }}
              >
                {menu.soundEnabled ? (
                  <SpeakerHigh size={18} aria-hidden="true" />
                ) : (
                  <SpeakerSlash size={18} aria-hidden="true" />
                )}
                <span className="tank-toolbar-label">
                  {menu.soundEnabled ? (compactBattle ? '音效' : '音效开') : '静音'}
                </span>
              </button>
              {compactBattle && (
                <>
                  {document.fullscreenEnabled && (
                    <button
                      type="button"
                      onClick={() => void toggleFullscreen()}
                      aria-label={fullscreen ? '退出全屏' : '进入全屏'}
                    >
                      {fullscreen ? (
                        <ArrowsIn size={18} aria-hidden="true" />
                      ) : (
                        <ArrowsOut size={18} aria-hidden="true" />
                      )}
                      <span className="tank-toolbar-label">{fullscreen ? '退出全屏' : '全屏'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="帮助"
                    onClick={() => {
                      gameRef.current?.suspend()
                      helpRef.current?.showModal()
                    }}
                  >
                    <Question size={18} aria-hidden="true" />
                    <span className="tank-toolbar-label">帮助</span>
                  </button>
                </>
              )}
              {(uiState === 'paused' || uiState === 'gameOver') && !customMap && (
                <button type="button" aria-label="返回标题" onClick={() => void returnToTitle()}>
                  <ArrowLeft size={18} aria-hidden="true" />
                  <span className="tank-toolbar-label">返回标题</span>
                </button>
              )}
            </div>
          </div>
        )}
        {compactBattle && (customMap || menu.mode === 'practice') && (
          <p className="tank-practice-note" data-tank-chrome>
            {customMap ? `自定义地图 · ${customMap.name}` : '单关练习'} · 三条生命 ·
            战绩不计入排行榜
            {customMap && ' · 试玩破坏不会写回原稿'}
          </p>
        )}
        {fullscreenError && (
          <p className="tank-practice-note" role="status" data-tank-chrome>
            {fullscreenError}
          </p>
        )}
        <div
          ref={stageRef}
          className={`tank-battle-stage ${!compactBattle ? 'is-title' : ''}`}
          onKeyDown={(event) => {
            if (uiState !== 'title' && uiState !== 'paused') return
            if ((event.target as HTMLElement).tagName === 'SELECT') return
            const action = (
              { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const
            )[event.key as 'ArrowUp']
            if (!action) return
            event.preventDefault()
            event.stopPropagation()
            if (!event.repeat) gameRef.current?.menuAction(action)
            canvasRef.current?.focus({ preventScroll: true })
          }}
        >
          <canvas
            ref={canvasRef}
            tabIndex={0}
            className="tank-battle-canvas"
            aria-label="坦克大战游戏画布"
          />
          {uiState === 'title' && (
            <TankMenu
              menu={menu}
              controllers={controllers}
              ready={ready}
              game={gameRef.current}
              focusGame={() => canvasRef.current?.focus({ preventScroll: true })}
            />
          )}
          {uiState === 'paused' && (
            <TankPauseMenu
              returnLabel={customMap ? returnLabel : undefined}
              menu={menu}
              controllers={controllers}
              ready={ready}
              game={gameRef.current}
              focusGame={() => canvasRef.current?.focus({ preventScroll: true })}
            />
          )}
        </div>
        {compactBattle && (
          <>
            <div className="tank-battle-help grid gap-2 border-t-2 border-[#343434] bg-[#111] px-4 py-3 font-mono-crt text-sm tracking-wide text-[#d8d8d8] md:grid-cols-2">
              <p className="tank-keyboard-help">移动：方向键 / WASD</p>
              <p className="tank-keyboard-help">开始：Enter · 开火：空格 / J · 暂停：P / Esc</p>
              <p className="tank-touch-help">左侧方向键移动，右侧按键开火</p>
            </div>
            <div className="tank-touch-controls" aria-label="坦克大战触控操作" data-tank-chrome>
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
          </>
        )}
        {!compactBattle && (
          <div className="tank-map-links">
            <button type="button" disabled={!ready} onClick={onEditor}>
              地图编辑
            </button>
            <button type="button" disabled={!ready} onClick={onLibrary}>
              我的地图
            </button>
          </div>
        )}
        {!compactBattle && (
          <details className="tank-field-guide">
            <summary>道具与作战指南</summary>
            <FieldGuide />
          </details>
        )}
        <dialog
          ref={helpRef}
          className="tank-help-dialog"
          aria-labelledby="tank-help-title"
          onClose={() => canvasRef.current?.focus({ preventScroll: true })}
        >
          <div className="tank-help-header">
            <h2 id="tank-help-title">操作与作战指南</h2>
            <form method="dialog">
              <button type="submit">关闭帮助</button>
            </form>
          </div>
          <p className="tank-keyboard-help">移动：方向键 / WASD · 开火：空格 / J · 暂停：P / Esc</p>
          <p className="tank-touch-help">左侧方向键移动，右侧按键开火。</p>
          <p>查看帮助时游戏已暂停，关闭后点击“继续”恢复战斗。</p>
          <FieldGuide />
        </dialog>
      </section>
    </div>
  )
}

function FieldGuide() {
  return (
    <>
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
        20,000 分时，每位尚未出局的玩家奖励一条生命。
      </p>
    </>
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
