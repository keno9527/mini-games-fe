import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowsHorizontal,
  GearSix,
  Heart,
  House,
  Pause,
  Play,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { LEVEL_DETAILS, LEVEL_LAYOUTS } from '../breakout/levels'
import { MobileGame, POWERUP_META } from './game'
import { MobileSave } from './storage'
import { mountMobileGame } from './runtime'
import './mobile.css'

const DesktopPreview = lazy(() => import('./DesktopPreview'))
type PendingAction = { kind: 'retry' | 'home' } | { kind: 'level'; level: number }

export default function BreakoutMobile() {
  const [desktop] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  return desktop ? (
    <Suspense fallback={<p role="status">正在准备手机试玩入口…</p>}>
      <DesktopPreview />
    </Suspense>
  ) : (
    <MobilePlayer />
  )
}

function MobilePlayer() {
  const navigate = useNavigate()
  const [{ game, save }] = useState(() => {
    const save = new MobileSave()
    return { save, game: new MobileGame(save.data.lastPlayedLevel - 1) }
  })
  const [snapshot, setSnapshot] = useState(() => game.snapshot())
  const [landscape, setLandscape] = useState(false)
  const [panel, setPanel] = useState<'menu' | 'settings'>('menu')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [showHint, setShowHint] = useState(true)
  const [audioError, setAudioError] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const sessionRef = useRef<ReturnType<typeof mountMobileGame> | null>(null)
  const ended = snapshot.status === 'won' || snapshot.status === 'lost'
  const paused = snapshot.status === 'paused'
  const ready = snapshot.status === 'ready'
  const modalOpen = (paused || ended) && !landscape

  useEffect(() => {
    const session = mountMobileGame(
      {
        root: rootRef.current!,
        canvas: canvasRef.current!,
        stage: stageRef.current!,
        controls: controlsRef.current!,
      },
      game,
      save,
      {
        update: setSnapshot,
        landscape: setLandscape,
        audioError: setAudioError,
        dragged: () => setShowHint(false),
      },
    )
    sessionRef.current = session
    return () => {
      session.destroy()
      sessionRef.current = null
    }
  }, [game, save])

  useEffect(() => {
    if (landscape) {
      setPanel('menu')
      setPendingAction(null)
      sessionRef.current?.settings(false)
    }
  }, [landscape])

  useEffect(() => {
    const dialog = dialogRef.current!
    if (modalOpen) {
      if (!dialog.open) dialog.showModal()
      dialog.querySelector<HTMLElement>('[data-menu-focus]')?.focus({ preventScroll: true })
    } else if (dialog.open) {
      dialog.close()
      if (!landscape) controlsRef.current?.focus({ preventScroll: true })
    }
  }, [modalOpen, landscape, panel, pendingAction])

  const openSettings = () => {
    sessionRef.current?.settings(true)
    setPanel('settings')
  }
  const backToMenu = () => {
    sessionRef.current?.settings(false)
    setPanel('menu')
  }
  const resume = () => {
    sessionRef.current?.settings(false)
    sessionRef.current?.resume()
  }
  const performAction = (action: PendingAction) => {
    sessionRef.current?.settings(false)
    setPendingAction(null)
    setPanel('menu')
    if (action.kind === 'home') navigate('/')
    else sessionRef.current?.reset(action.kind === 'level' ? action.level : undefined)
  }
  const requestAction = (action: PendingAction) => {
    if (action.kind === 'level' && action.level === snapshot.level) return
    if (snapshot.challengeStarted && !ended) setPendingAction(action)
    else performAction(action)
  }
  const changeAudio = (change: Partial<typeof save.data.audio>) =>
    sessionRef.current?.audio({ ...save.data.audio, ...change })
  const menuTitle = pendingAction
    ? pendingAction.kind === 'home'
      ? '结束挑战并返回首页？'
      : pendingAction.kind === 'level'
        ? `切换到第 ${pendingAction.level + 1} 关？`
        : '重新挑战本关？'
    : panel === 'settings'
      ? '游戏设置'
      : ended
        ? snapshot.status === 'won'
          ? '30 关，全部拿下！'
          : '挑战结束'
        : '游戏已暂停'

  return (
    <main className="bm-game" ref={rootRef} aria-label="打砖块（手机端）">
      <div className="bm-console" inert={landscape}>
        <h1 className="sr-only">打砖块（手机端）</h1>
        <header className="bm-header">
          <dl className="bm-hud">
            <div>
              <dt>关卡</dt>
              <dd>
                {String(snapshot.level + 1).padStart(2, '0')}
                <small> / {LEVEL_LAYOUTS.length}</small>
              </dd>
            </div>
            <div className="bm-score">
              <dt>得分</dt>
              <dd>{String(snapshot.score).padStart(4, '0')}</dd>
            </div>
            <div>
              <dt>生命</dt>
              <dd>
                <Heart size={16} weight="fill" aria-hidden="true" />
                {snapshot.lives}
              </dd>
            </div>
          </dl>
          <button
            className="bm-icon-button"
            onClick={() => sessionRef.current?.pause()}
            aria-label="暂停游戏"
            disabled={ended}
          >
            <Pause size={22} weight="fill" />
          </button>
        </header>
        <div className="bm-stage-title">
          <span>{LEVEL_DETAILS[snapshot.level].name}</span>
          <span>
            剩余 {snapshot.remaining} 块{snapshot.combo > 1 ? ` · ${snapshot.combo} 连击` : ''}
          </span>
        </div>
        <div className="bm-playfield">
          <div className="bm-stage" ref={stageRef}>
            <canvas ref={canvasRef} aria-label="打砖块画面；在画面下半部分或下方左右滑动控制挡板" />
          </div>
          <div className="bm-rest" aria-hidden="true">
            {showHint && !paused && !ended && (
              <div className="bm-hint">
                <ArrowsHorizontal size={24} />
                <span>在这里或画面下方左右滑动</span>
              </div>
            )}
          </div>
          <div
            ref={controlsRef}
            className="bm-controls"
            role="slider"
            tabIndex={0}
            aria-label="左右滑动控制挡板"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={50}
            aria-orientation="horizontal"
            aria-disabled={paused || ended || landscape}
          />
          {ready && (
            <div className="bm-launch">
              <button className="bm-primary" onClick={() => sessionRef.current?.launch()}>
                <Play size={20} weight="fill" />
                点击发球
              </button>
              <p role="status">
                {snapshot.message === '先左右滑动，再点发球'
                  ? '准备好，接住每一个好球'
                  : snapshot.message}
              </p>
            </div>
          )}
        </div>
        {save.error && (
          <p className="bm-save-error" role="alert">
            {save.error}
          </p>
        )}
        {audioError && (
          <button className="bm-audio-error" onClick={() => sessionRef.current?.retryAudio()}>
            {audioError}
          </button>
        )}
      </div>

      {landscape && (
        <div className="bm-rotate" role="alert">
          <span aria-hidden="true">↻</span>
          <h2>竖起手机，继续接球</h2>
          <p>游戏已暂停，转回竖屏后可继续。</p>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className={`bm-dialog ${panel === 'settings' && !pendingAction ? 'bm-settings' : ''}`}
        aria-labelledby="bm-menu-title"
        onCancel={(event) => {
          event.preventDefault()
          if (pendingAction) setPendingAction(null)
          else if (panel === 'settings') backToMenu()
        }}
      >
        <header className="bm-dialog-header">
          {panel === 'settings' && !pendingAction && (
            <button className="bm-icon-button" onClick={backToMenu} aria-label="返回暂停菜单">
              <ArrowLeft size={22} />
            </button>
          )}
          <div>
            <p className="bm-kicker">
              {pendingAction
                ? '重新出发'
                : panel === 'settings'
                  ? '按你的节奏'
                  : ended
                    ? '每一球都是新的机会'
                    : '休息一下，好球还在'}
            </p>
            <h2 id="bm-menu-title">{menuTitle}</h2>
          </div>
        </header>
        {pendingAction ? (
          <div className="bm-menu-actions">
            <p className="bm-help">
              {pendingAction.kind === 'home'
                ? '本次挑战将结束。最近关卡和已保存的最好成绩会保留，球的位置及本次未结算进度不会保存。'
                : '当前挑战将结束，分数清零、生命恢复为 3。已保存的最好成绩会保留。'}
            </p>
            <button className="bm-primary" data-menu-focus onClick={() => setPendingAction(null)}>
              取消，保留当前挑战
            </button>
            <button className="bm-secondary" onClick={() => performAction(pendingAction)}>
              {pendingAction.kind === 'home'
                ? '结束并返回首页'
                : pendingAction.kind === 'level'
                  ? '确认切换关卡'
                  : '确认重试本关'}
            </button>
          </div>
        ) : panel === 'settings' ? (
          <>
            <label className="bm-select-label">
              选择关卡
              <select
                aria-label="选择关卡"
                data-menu-focus
                value={snapshot.level}
                onChange={(event) =>
                  requestAction({ kind: 'level', level: Number(event.target.value) })
                }
              >
                {LEVEL_DETAILS.map((level, index) => (
                  <option key={level.name} value={index}>
                    第 {index + 1} 关 · {level.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="bm-help">切换关卡会重新开始，得分清零、生命恢复为 3。</p>
            <div className="bm-settings-row">
              <span>游戏音效</span>
              <button
                className="bm-toggle"
                aria-pressed={save.data.audio.enabled}
                onClick={() => changeAudio({ enabled: !save.data.audio.enabled })}
              >
                {save.data.audio.enabled ? '已开启' : '已关闭'}
              </button>
            </div>
            <label className="bm-volume">
              音量 <output>{Math.round(save.data.audio.volume * 100)}%</output>
              <input
                aria-label="音量"
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(save.data.audio.volume * 100)}
                onChange={(event) => changeAudio({ volume: Number(event.target.value) / 100 })}
              />
            </label>
            <section className="bm-tools" aria-label="道具说明">
              <h3>接住这些小帮手</h3>
              {Object.entries(POWERUP_META).map(([type, meta]) => (
                <div key={type}>
                  <i style={{ backgroundColor: meta.color }}>{meta.label}</i>
                  <span>
                    {meta.name}
                    {type === 'laser' && <small>自动连发</small>}
                  </span>
                </div>
              ))}
            </section>
            <p className="bm-best">
              最好成绩 <strong>{save.data.bestScore}</strong>
            </p>
            <p className="bm-help">
              进度仅保存在当前浏览器。Safari
              和微信分别保存；清除网站数据会清除进度。重新打开时从最近关卡开始。
            </p>
            <button className="bm-primary" onClick={backToMenu}>
              返回暂停菜单
            </button>
          </>
        ) : (
          <div className="bm-menu-actions">
            <div className="bm-result">
              <span>
                本次得分<strong>{snapshot.score}</strong>
              </span>
              <span>
                {ended ? '最好成绩' : '当前关卡'}
                <strong>
                  {ended ? save.data.bestScore : `${snapshot.level + 1} / ${LEVEL_LAYOUTS.length}`}
                </strong>
              </span>
            </div>
            {ended ? (
              <button
                className="bm-primary"
                data-menu-focus
                onClick={() => requestAction({ kind: 'retry' })}
              >
                <ArrowCounterClockwise size={21} />
                重试本关
              </button>
            ) : (
              <>
                <button className="bm-primary" data-menu-focus onClick={resume}>
                  <Play size={21} weight="fill" />
                  继续游戏
                </button>
                <button className="bm-secondary" onClick={() => requestAction({ kind: 'retry' })}>
                  <ArrowCounterClockwise size={21} />
                  重试本关
                </button>
              </>
            )}
            <div className="bm-menu-links">
              <button className="bm-secondary" onClick={openSettings}>
                <GearSix size={20} />
                设置
              </button>
              <button className="bm-secondary" onClick={() => requestAction({ kind: 'home' })}>
                <House size={20} />
                返回首页
              </button>
            </div>
            {ended && <p className="bm-help">重试将从当前关开始。进度仅保存在当前浏览器。</p>}
          </div>
        )}
        {save.error && (
          <p className="bm-save-error" role="alert">
            {save.error}
          </p>
        )}
        {audioError && (
          <button className="bm-audio-error" onClick={() => sessionRef.current?.retryAudio()}>
            {audioError}
          </button>
        )}
      </dialog>
    </main>
  )
}
