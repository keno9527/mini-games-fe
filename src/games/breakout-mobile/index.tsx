import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowsHorizontal,
  GearSix,
  Heart,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from '@phosphor-icons/react'
import { LEVEL_DETAILS, LEVEL_LAYOUTS } from '../breakout/levels'
import { MobileGame, POWERUP_META } from './game'
import { MobileSave } from './storage'
import { mountMobileGame } from './runtime'
import './mobile.css'

const DesktopPreview = lazy(() => import('./DesktopPreview'))

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
  const [{ game, save }] = useState(() => {
    const save = new MobileSave()
    return { save, game: new MobileGame(save.data.lastPlayedLevel - 1) }
  })
  const [snapshot, setSnapshot] = useState(() => game.snapshot())
  const [landscape, setLandscape] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [audioError, setAudioError] = useState('')
  const rootRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const padRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const sessionRef = useRef<ReturnType<typeof mountMobileGame> | null>(null)

  useEffect(() => {
    const session = mountMobileGame(
      {
        root: rootRef.current!,
        canvas: canvasRef.current!,
        stage: stageRef.current!,
        pad: padRef.current!,
      },
      game,
      save,
      { update: setSnapshot, landscape: setLandscape, audioError: setAudioError },
    )
    sessionRef.current = session
    return () => {
      session.destroy()
      sessionRef.current = null
    }
  }, [game, save])

  useEffect(() => {
    if (landscape) setSettingsOpen(false)
  }, [landscape])

  useEffect(() => {
    const dialog = dialogRef.current!
    if (settingsOpen && !landscape) dialog.showModal()
    else if (dialog.open) dialog.close()
  }, [settingsOpen, landscape])

  const openSettings = () => {
    sessionRef.current?.settings(true)
    setSettingsOpen(true)
  }
  const closeSettings = () => {
    sessionRef.current?.settings(false)
    setSettingsOpen(false)
  }
  const changeAudio = (change: Partial<typeof save.data.audio>) =>
    sessionRef.current?.audio({ ...save.data.audio, ...change })
  const ended = snapshot.status === 'won' || snapshot.status === 'lost'
  const paused = snapshot.status === 'paused'
  const ready = snapshot.status === 'ready'
  const primaryLabel = ended ? '重试本关' : paused ? '继续游戏' : ready ? '发球' : '暂停'
  const primaryAction = () => {
    const session = sessionRef.current
    if (ended) session?.reset()
    else if (paused) session?.resume()
    else if (ready) session?.launch()
    else session?.pause()
  }

  return (
    <main className="bm-game" ref={rootRef} aria-label="打砖块（手机端）">
      <div className="bm-console" inert={landscape}>
        <header className="bm-header">
          <Link className="bm-icon-button" to="/" aria-label="返回首页">
            <ArrowLeft size={22} />
          </Link>
          <h1>
            打砖块<span>POCKET BREAKER</span>
          </h1>
          <button className="bm-icon-button" onClick={openSettings} aria-label="游戏设置">
            <GearSix size={23} />
          </button>
        </header>

        <dl className="bm-hud">
          <div>
            <dt>关卡</dt>
            <dd>
              {String(snapshot.level + 1).padStart(2, '0')}
              <small> / {LEVEL_LAYOUTS.length}</small>
            </dd>
          </div>
          <div className="bm-score">
            <dt>本次得分</dt>
            <dd>{String(snapshot.score).padStart(4, '0')}</dd>
          </div>
          <div>
            <dt>生命</dt>
            <dd>
              <Heart size={17} weight="fill" aria-hidden="true" />
              {snapshot.lives}
            </dd>
          </div>
        </dl>

        <div className="bm-stage-title">
          <span>{LEVEL_DETAILS[snapshot.level].name}</span>
          <span>
            剩余 {snapshot.remaining} 块{snapshot.combo > 1 ? ` · ${snapshot.combo} 连击` : ''}
          </span>
        </div>
        <div className="bm-stage" ref={stageRef}>
          <canvas
            ref={canvasRef}
            aria-label="打砖块画面；使用下方滑动区移动挡板，发球按钮开始游戏"
          />
          {(paused || ended) && (
            <div className="bm-overlay" role="status">
              <p className="bm-kicker">
                {paused
                  ? 'TAKE A BREATH'
                  : snapshot.status === 'won'
                    ? 'ALL CLEAR'
                    : 'ONE MORE TRY'}
              </p>
              <h2>
                {paused
                  ? '休息一下'
                  : snapshot.status === 'won'
                    ? '30 关，全部拿下！'
                    : '再来一次，好球在后面'}
              </h2>
              <p>
                {paused
                  ? '准备好后，点下方「继续游戏」'
                  : `本次得分 ${snapshot.score} · 最好 ${save.data.bestScore}`}
              </p>
            </div>
          )}
        </div>

        <p className="bm-message" role="status">
          {ready
            ? snapshot.message
            : paused
              ? '游戏已暂停'
              : ended
                ? '重试会从当前关重新开始'
                : '盯住球，把方向交给拇指'}
        </p>
        <div
          ref={padRef}
          className="bm-pad"
          role="slider"
          tabIndex={0}
          aria-label="左右滑动控制挡板"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          aria-orientation="horizontal"
          aria-disabled={paused || ended}
        >
          <ArrowsHorizontal size={26} aria-hidden="true" />
          <span>左右滑动</span>
          <small>移动挡板 · 不会自动发球</small>
        </div>
        <div className="bm-actions">
          <button className="bm-primary" onClick={primaryAction}>
            {snapshot.status === 'playing' ? (
              <Pause size={21} weight="fill" />
            ) : (
              <Play size={20} weight="fill" />
            )}
            {primaryLabel}
          </button>
          <button
            className="bm-sound"
            onClick={() => changeAudio({ enabled: !save.data.audio.enabled })}
            aria-label={save.data.audio.enabled ? '关闭音效' : '开启音效'}
            aria-pressed={save.data.audio.enabled}
          >
            {save.data.audio.enabled ? <SpeakerHigh size={23} /> : <SpeakerSlash size={23} />}
          </button>
        </div>
        <footer className="bm-footer">
          <span>最好 {save.data.bestScore}</span>
          <span>进度保存在当前浏览器</span>
        </footer>
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
          <p>游戏已暂停。转回竖屏后，点「继续游戏」。</p>
          <Link to="/">返回首页</Link>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="bm-settings"
        aria-labelledby="bm-settings-title"
        onClose={closeSettings}
        onCancel={closeSettings}
      >
        <header>
          <div>
            <p className="bm-kicker">YOUR GAME, YOUR PACE</p>
            <h2 id="bm-settings-title">游戏设置</h2>
          </div>
          <button className="bm-icon-button" onClick={closeSettings} aria-label="关闭设置">
            <X size={24} />
          </button>
        </header>
        <label className="bm-select-label">
          选择关卡
          <select
            aria-label="选择关卡"
            value={snapshot.level}
            onChange={(event) => sessionRef.current?.reset(Number(event.target.value))}
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
        <p className="bm-help">
          进度仅保存在当前浏览器。Safari
          和微信分别保存；清除网站数据会清除进度。重新打开时从最近关卡开始。
        </p>
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
        <button className="bm-primary" onClick={closeSettings}>
          返回游戏
        </button>
      </dialog>
    </main>
  )
}
