import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import type { TankBattleControllers, TankBattleHandle, TankBattleMenu } from './runtime.ts'
import type { TankMode } from './core/TankLobby.ts'
import { LEVELS } from './data/levels.ts'
import { PLAYER_TANK_SPRITES } from './data/sprites.ts'
import { drawBase, drawTerrainCell, drawTreeCell, drawMatrix } from './render/drawSprites.ts'
import { Base } from './entity/Base.ts'
import { Direction, TerrainKind } from './types.ts'
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

function BaseScenery() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 336, 32)
    for (let x = 0; x < 21; x++) {
      if (x === 10) continue
      if ([6, 7, 13, 14].includes(x)) drawTreeCell(ctx, x, 1)
      else {
        drawTerrainCell(ctx, x, 1, TerrainKind.BRICK, 0xffff, 0)
        if (![2, 3, 17, 18].includes(x)) drawTerrainCell(ctx, x, 0, TerrainKind.BRICK, 0xffff, 0)
      }
    }
    ctx.save()
    const base = new Base()
    ctx.translate(160 - base.cellX * 16, 16 - base.cellY * 16)
    drawBase(ctx, base)
    ctx.restore()
  }, [])
  return (
    <canvas ref={ref} width={336} height={32} className="tank-menu-scenery" aria-hidden="true" />
  )
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
  const coop = menu.mode === 'coop'
  const missing =
    controllers.bindings[0] === null
      ? '第一位'
      : coop && controllers.bindings[1] === null
        ? '第二位'
        : null
  const choose = (mode: TankMode) => {
    game?.selectMode(mode)
    focusGame()
  }
  return (
    <div className="tank-title-screen" aria-label="坦克大战标题菜单">
      <header className="tank-title-heading">
        <img src={titleImage} alt="BATTLE CITY" />
        <h2>坦克大战</h2>
      </header>
      <div className="tank-menu-content">
        <nav className="tank-mode-menu" aria-label="游玩模式">
          {(
            [
              ['single', '单人作战'],
              ['coop', '双人合作'],
              ['practice', '关卡练习'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              disabled={!ready}
              aria-pressed={menu.mode === mode}
              onClick={() => choose(mode)}
            >
              <span className="tank-menu-pointer">
                <TankSprite pointer />
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="tank-join-panel">
          <h3>
            {coop ? '合作守护基地' : menu.mode === 'practice' ? '练习你的作战技巧' : '独自守护基地'}
          </h3>
          <ControllerStatus controllers={controllers} coop={coop} />
          {menu.mode === 'practice' && (
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
                第{' '}
                <select
                  aria-label="练习关卡"
                  value={menu.practiceStage}
                  onChange={(e) => game?.setPracticeStage(Number(e.target.value))}
                >
                  {Array.from({ length: LEVELS.length }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i + 1).padStart(2, '0')}
                    </option>
                  ))}
                </select>{' '}
                关
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
          )}
          <div className="tank-join-message" role="status">
            <p>
              {!ready
                ? '正在准备战场…'
                : !controllers.canPlay
                  ? missing
                    ? `请${coop ? missing : ''}玩家按 A / × 加入`
                    : '等待手柄读取恢复'
                  : coop
                    ? '两位玩家已就绪'
                    : controllers.bindings[0] === null
                      ? '按 Enter 开始 · 手柄按 A / × 加入'
                      : '手柄已就绪，按 A / × 开始'}
            </p>
            <small>
              {coop
                ? '加入后由 P1 确认开始'
                : menu.mode === 'practice'
                  ? '单关练习 · 战绩不计入排行榜'
                  : '经典战役 · 35 关 · 守住老鹰基地'}
            </small>
          </div>
          <ConnectionHint controllers={controllers} />
          <button
            type="button"
            className="tank-menu-start"
            disabled={!ready || !controllers.canPlay}
            onClick={() => {
              game?.confirm()
              focusGame()
            }}
          >
            {coop ? 'P1 确认开始' : '开始游戏'}
          </button>
          {!coop && controllers.bindings[0] !== null && controllers.canPlay && (
            <button type="button" className="tank-menu-link" onClick={() => game?.useKeyboard()}>
              使用键盘 / 触控
            </button>
          )}
          {!coop && !controllers.canPlay && (
            <button type="button" className="tank-menu-link" onClick={() => game?.useKeyboard()}>
              切回键盘 / 触控
            </button>
          )}
        </div>
      </div>
      <BaseScenery />
      <footer className="tank-menu-footer">
        <button
          type="button"
          onClick={() => {
            game?.menuAction('back')
            focusGame()
          }}
        >
          B / ○ 返回
        </button>
        <span>
          <ArrowUp aria-hidden="true" />
          <ArrowDown aria-hidden="true" /> 选择{' '}
          <span className="tank-confirm-hint">A / × 确认</span>
        </span>
      </footer>
    </div>
  )
}

export function TankPauseMenu({ menu, controllers, game, focusGame }: MenuProps) {
  const coop = menu.mode === 'coop'
  const labels = [
    '继续作战',
    menu.soundEnabled ? '音效：开' : '音效：关',
    '重新分配手柄',
    '返回标题',
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
