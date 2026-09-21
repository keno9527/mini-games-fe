import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import type { TankBattleControllers, TankBattleHandle, TankBattleMenu } from './runtime.ts'
import type { TankMode } from './core/TankLobby.ts'
import { LEVELS } from './data/levels.ts'
import { PLAYER_TANK_SPRITES } from './data/sprites.ts'
import { drawMatrix } from './render/drawSprites.ts'
import { Direction } from './types.ts'
import { COLORS } from './render/palette.ts'
import titleImage from './assets/title.png'

export function TankSprite({
  blue = false,
  pointer = false,
}: {
  blue?: boolean
  pointer?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 16, 16)
    drawMatrix(ctx, PLAYER_TANK_SPRITES[0][pointer ? Direction.RIGHT : Direction.UP], 0, 0, {
      '1': blue ? '#4cb9e7' : COLORS.PLAYER_BODY,
      '2': blue ? '#24617d' : COLORS.PLAYER_TREAD,
      '3': blue ? '#e0f8ff' : COLORS.PLAYER_HIGHLIGHT,
    })
  }, [blue, pointer])
  return <canvas ref={ref} width={16} height={16} className="tank-menu-sprite" aria-hidden="true" />
}

interface MenuProps {
  menu: TankBattleMenu
  controllers: TankBattleControllers
  ready: boolean
  game: TankBattleHandle | null
  focusGame: () => void
}
export function ControllerStatus({
  controllers,
  coop,
}: {
  controllers: TankBattleControllers
  coop: boolean
}) {
  return (
    <div className="tank-menu-players" aria-label="玩家加入状态">
      {(coop ? [0, 1] : [0]).map((slot) => (
        <div key={slot} className={slot === 0 ? 'tank-player-one' : 'tank-player-two'}>
          <TankSprite blue={slot === 1} />
          <strong>P{slot + 1}</strong>
          <span
            className={
              controllers.bindings[slot] === null && (coop || !controllers.canPlay)
                ? 'tank-player-waiting'
                : undefined
            }
          >
            {controllers.bindings[slot] !== null
              ? controllers.snapshot.status === 'ready'
                ? '已就绪'
                : '等待恢复'
              : !coop && controllers.canPlay
                ? '键盘 / 触控'
                : '等待加入'}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ConnectionHint({ controllers }: { controllers: TankBattleControllers }) {
  const status = controllers.snapshot.status
  const text =
    status === 'insecure'
      ? '手柄连接需要 HTTPS 或 localhost 地址。'
      : status === 'unsupported'
        ? '浏览器不支持手柄，可使用键盘或触控单人游玩。'
        : status === 'error'
          ? '手柄读取失败，请检查连接后重试。'
          : status === 'paused'
            ? '返回游戏后，先松开手柄按键再操作。'
            : controllers.snapshot.devices.some((d) => d.mapping !== 'standard')
              ? '检测到非标准映射手柄，暂不支持加入。'
              : null
  return text ? (
    <p className="tank-connection-hint" role="status">
      {text}
    </p>
  ) : null
}

export function TankMenu({ menu, controllers, ready, game, focusGame }: MenuProps) {
  const choose = (mode: TankMode) => {
    game?.selectMode(mode)
    game?.confirm()
    focusGame()
  }
  return (
    <div className="tank-title-screen" aria-label="坦克大战标题菜单">
      <header className="tank-title-heading">
        <h2>
          <img src={titleImage} alt="BATTLE CITY" />
        </h2>
      </header>
      {menu.page === 'modes' ? (
        <nav className="tank-mode-menu" aria-label="游玩模式">
          {(
            [
              ['single', '1 PLAYER', '单人作战'],
              ['coop', '2 PLAYERS', '双人合作'],
              ['practice', 'STAGE SELECT', '关卡练习'],
            ] as const
          ).map(([mode, label, name]) => (
            <button
              key={mode}
              type="button"
              disabled={!ready}
              aria-label={name}
              aria-pressed={menu.mode === mode}
              onClick={() => choose(mode)}
            >
              <span className="tank-menu-pointer">
                <TankSprite pointer />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      ) : (
        <div className="tank-practice-menu" aria-label="关卡练习选关">
          <h3>STAGE SELECT</h3>
          <div className="tank-stage-select">
            <button
              type="button"
              aria-label="上一关"
              disabled={menu.practiceStage === 0}
              onClick={() => game?.setPracticeStage(menu.practiceStage - 1)}
            >
              <ArrowLeft />
            </button>
            <label>
              <span className="sr-only">练习关卡</span>
              <select
                aria-label="练习关卡"
                value={menu.practiceStage}
                onChange={(e) => game?.setPracticeStage(Number(e.target.value))}
              >
                {LEVELS.map((_, i) => (
                  <option key={i} value={i}>
                    {String(i + 1).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-label="下一关"
              disabled={menu.practiceStage === LEVELS.length - 1}
              onClick={() => game?.setPracticeStage(menu.practiceStage + 1)}
            >
              <ArrowRight />
            </button>
          </div>
          <p>单关练习 · 战绩不计入排行榜</p>
          <div className="tank-practice-actions">
            <button
              type="button"
              onClick={() => {
                game?.menuAction('back')
                focusGame()
              }}
            >
              返回
            </button>
            <button
              type="button"
              onClick={() => {
                game?.confirm()
                focusGame()
              }}
            >
              开始
            </button>
          </div>
        </div>
      )}
      <div className="tank-title-notice" role="status">
        {!ready
          ? '正在准备战场…'
          : menu.awaitingControllers && (
              <>
                <p>
                  {controllers.bindings[0] === null
                    ? '请连接两只手柄，并按 A / × 激活'
                    : controllers.bindings[1] === null && menu.mode === 'coop'
                      ? '请连接第二只手柄，并按 A / × 激活'
                      : '等待手柄恢复连接'}
                </p>
                <ConnectionHint controllers={controllers} />
                <button
                  type="button"
                  onClick={() => {
                    game?.menuAction('back')
                    focusGame()
                  }}
                >
                  取消
                </button>
              </>
            )}
      </div>
      <footer className="tank-menu-footer">
        <p>{menu.page === 'practice' ? '← → 选关' : '↑ ↓ 选择'} · Enter / A / × 确认</p>
        <small>点击菜单即可开始</small>
      </footer>
    </div>
  )
}

export function TankPauseMenu({
  menu,
  controllers,
  game,
  focusGame,
  returnLabel = '返回标题',
}: MenuProps & { returnLabel?: string }) {
  const coop = menu.mode === 'coop'
  const labels = [
    '继续作战',
    menu.soundEnabled ? '音效：开' : '音效：关',
    '重新分配手柄',
    returnLabel,
  ]
  const actions = [
    () => game?.togglePause(),
    () => game?.setSoundEnabled(!menu.soundEnabled),
    () => game?.reassignGamepads(),
    () => game?.returnToTitle(),
  ]
  return (
    <div className="tank-pause-screen" aria-label="暂停菜单">
      <h2>{controllers.canPlay ? '作战暂停' : '等待手柄连接'}</h2>
      {!controllers.canPlay && (
        <>
          <ControllerStatus controllers={controllers} coop={coop} />
          <p role="status">
            {controllers.bindings[0] === null
              ? '请 P1 按 A / × 重新加入'
              : coop && controllers.bindings[1] === null
                ? '请 P2 按 A / × 重新加入'
                : '手柄读取恢复后，按确认继续'}
          </p>
          <small>角色位置与本局进度保留，连接后手动继续</small>
        </>
      )}
      <ConnectionHint controllers={controllers} />
      <div className="tank-pause-actions">
        {labels.map((label, i) => (
          <button
            type="button"
            key={i}
            className={menu.pauseSelection === i ? 'is-selected' : ''}
            disabled={i === 0 && !controllers.canPlay}
            onClick={() => {
              actions[i]()
              focusGame()
            }}
          >
            {label}
          </button>
        ))}
        {!coop && !controllers.canPlay && (
          <button type="button" onClick={() => game?.useKeyboard()}>
            切回键盘 / 触控
          </button>
        )}
      </div>
      <p className="tank-pause-help">
        方向键 / 左摇杆移动 · A / × 或 R2 开火
        <br />
        Options 暂停 · B / ○ 返回
      </p>
    </div>
  )
}
