import { useCallback, useEffect, useRef, useState } from 'react'
import { useGamePlay } from '@/hooks/useGamePlay'
import { useGameRecord } from '@/hooks/useGameRecord'
import AdventureBoard from './AdventureBoard'
import { createState, positions, queueDirection, step, type SnakeState } from './engine'
import { chapters, levels, STEP_MS, type Direction, type SnakeLevel } from './levels'
import { readProgress, recordCompletion, saveProgress, unlockedLevel } from './progression'

interface Props {
  gameId: string
  userId?: string
}
type Phase = 'preview' | 'countdown' | 'playing' | 'paused' | 'won' | 'lost'
const directions: { value: Direction; label: string; symbol: string }[] = [
  { value: 'UP', label: '向上', symbol: '↑' },
  { value: 'LEFT', label: '向左', symbol: '←' },
  { value: 'DOWN', label: '向下', symbol: '↓' },
  { value: 'RIGHT', label: '向右', symbol: '→' },
]

export default function Adventure({ gameId, userId }: Props) {
  const [progress, setProgress] = useState(() => readProgress(gameId, userId))
  const [current, setCurrent] = useState(() => unlockedLevel(readProgress(gameId, userId)))
  const [picking, setPicking] = useState(false)
  const unlocked = unlockedLevel(progress)
  const completed = Object.keys(progress).length
  const gems = Object.values(progress).filter((result) => result.medal === 2).length
  const level = levels[current]

  const complete = useCallback(
    (state: SnakeState) => {
      const next = recordCompletion(progress, level.id, state.moves, state.gem)
      if (userId) saveProgress(gameId, userId, next)
      setProgress(next)
    },
    [gameId, userId, progress, level.id],
  )

  return (
    <section className="snake-game snake-adventure" aria-label="贪吃蛇机关闯关">
      <header className="snake-heading">
        <div>
          <p className="snake-eyebrow">机关花园 · 一路拾趣</p>
          <h2>
            青玉游蛇 <span>慢慢探索，关关有趣</span>
          </h2>
        </div>
        <span className="snake-seal" aria-hidden="true">
          闯关
        </span>
      </header>
      <div className="snake-adventure-progress" aria-label="闯关进度">
        <span>
          已通关 <strong>{completed} / 9</strong>
        </span>
        <span>
          宝石 <strong>{gems} / 9</strong>
        </span>
        <span>不设限时 · 随时重试</span>
      </div>
      {!userId && <p role="status">未选择玩家，进度仅保留在当前页面。</p>}
      {picking ? (
        <div className="snake-picker">
          <div className="snake-adventure-title">
            <h3>选择关卡</h3>
            <button type="button" className="snake-pause" onClick={() => setPicking(false)}>
              返回本关
            </button>
          </div>
          <p>通关即可解锁下一关，宝石是可选挑战。</p>
          {chapters.map((chapter, chapterIndex) => (
            <section key={chapter} aria-label={chapter}>
              <h4>
                0{chapterIndex + 1} · {chapter}
              </h4>
              <div className="snake-adventure-levels">
                {levels.slice(chapterIndex * 3, chapterIndex * 3 + 3).map((item, offset) => {
                  const index = chapterIndex * 3 + offset
                  const result = progress[item.id]
                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={index > unlocked}
                      aria-label={`第 ${index + 1} 关 ${item.name}，${index > unlocked ? '未解锁' : result ? '已通关' : '可挑战'}`}
                      aria-current={index === current ? 'true' : undefined}
                      onClick={() => {
                        setCurrent(index)
                        setPicking(false)
                      }}
                    >
                      <span className="snake-level-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <strong>{item.name}</strong>
                      <small>
                        {index > unlocked
                          ? '先通关上一关'
                          : result
                            ? `✓ 已通关 · ${result.bestMoves} 步`
                            : '可以挑战'}
                      </small>
                      {result?.medal === 2 && (
                        <span className="snake-gem-earned">◆ 宝石已收集</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Round
          key={level.id}
          level={level}
          index={current}
          gameId={gameId}
          userId={userId}
          bestMoves={progress[level.id]?.bestMoves}
          onComplete={complete}
          onPick={() => setPicking(true)}
          onNext={current < levels.length - 1 ? () => setCurrent(current + 1) : undefined}
        />
      )}
    </section>
  )
}

interface RoundProps extends Props {
  level: SnakeLevel
  index: number
  bestMoves?: number
  onComplete: (state: SnakeState) => void
  onPick: () => void
  onNext?: () => void
}

function Round({
  level,
  index,
  gameId,
  userId,
  bestMoves,
  onComplete,
  onPick,
  onNext,
}: RoundProps) {
  const [state, setState] = useState(() => createState(level))
  const stateRef = useRef(state)
  const [phase, setPhase] = useState<Phase>('preview')
  const phaseRef = useRef<Phase>('preview')
  const [countdown, setCountdown] = useState(3)
  const [attempt, setAttempt] = useState(0)
  const boardFrame = useRef<HTMLDivElement>(null)
  const elapsed = useRef(0)
  const activeSince = useRef<number | null>(null)
  const turns = useRef<Direction[]>([])
  const started = useRef(false)
  const [saveError, setSaveError] = useState('')
  const record = useGameRecord({ gameId, userId })
  const { start, reset, submit } = record
  useGamePlay(gameId, phase === 'playing' || phase === 'paused' ? phase : 'idle')
  const total = positions(level, 'o').length

  const changePhase = useCallback((next: Phase) => {
    if (activeSince.current !== null) elapsed.current += performance.now() - activeSince.current
    activeSince.current = next === 'playing' ? performance.now() : null
    phaseRef.current = next
    setPhase(next)
  }, [])
  const begin = useCallback(() => {
    const initial = createState(level)
    stateRef.current = initial
    setState(initial)
    turns.current = []
    started.current = false
    reset()
    setSaveError('')
    setCountdown(3)
    changePhase('countdown')
    elapsed.current = 0
    setAttempt((value) => value + 1)
    boardFrame.current?.scrollIntoView({ block: 'start' })
  }, [level, reset, changePhase])
  const turn = useCallback((direction: Direction) => {
    if (phaseRef.current !== 'playing') return
    turns.current = queueDirection(stateRef.current.direction, turns.current, direction)
  }, [])
  const pause = useCallback(() => {
    if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') {
      turns.current = []
      changePhase('paused')
    } else if (phaseRef.current === 'paused') {
      if (started.current) changePhase('playing')
      else {
        setCountdown(3)
        changePhase('countdown')
      }
    }
  }, [changePhase])
  const settle = useCallback(
    (result: SnakeState) => {
      try {
        if (result.status === 'won') onComplete(result)
        setSaveError('')
        void submit({
          level: index + 1,
          score: (total - result.apples.length) * 10,
          result: result.status === 'won' ? 'win' : 'lose',
          duration: Math.max(1, Math.round(elapsed.current / 1000)),
        })
      } catch {
        setSaveError('进度暂未写入玩家档案，请重试保存。')
      }
    },
    [onComplete, submit, index, total],
  )

  useEffect(() => {
    if (phase !== 'countdown') return
    const timer = window.setInterval(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearInterval(timer)
  }, [phase, attempt])
  useEffect(() => {
    if (phase !== 'countdown' || countdown > 0) return
    started.current = true
    start()
    changePhase('playing')
  }, [phase, countdown, start, changePhase])
  useEffect(() => {
    if (phase !== 'playing') return
    const timer = window.setInterval(() => {
      if (phaseRef.current !== 'playing') return
      const next = step(level, stateRef.current, turns.current.shift())
      stateRef.current = next
      setState(next)
      if (next.status !== 'playing') {
        changePhase(next.status)
        settle(next)
      }
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [phase, level, changePhase, settle])
  useEffect(() => {
    const hide = () => {
      if (document.hidden && (phaseRef.current === 'playing' || phaseRef.current === 'countdown'))
        pause()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return
      const map: Record<string, Direction> = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP',
        a: 'LEFT',
        s: 'DOWN',
        d: 'RIGHT',
      }
      const direction = map[event.key] ?? map[event.key.toLowerCase()]
      if (direction && phaseRef.current === 'playing') {
        event.preventDefault()
        if (!event.repeat) turn(direction)
      }
      if (
        event.code === 'Space' &&
        !(event.target instanceof HTMLElement && event.target.closest('button, a'))
      ) {
        event.preventDefault()
        if (!event.repeat) pause()
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [turn, pause])

  const finished = phase === 'won' || phase === 'lost'
  const running = phase === 'playing' || phase === 'countdown' || phase === 'paused'
  return (
    <>
      <div className="snake-adventure-title">
        <div>
          <p>
            {chapters[Math.floor(index / 3)]} · 第 {index + 1} / 9 关
          </p>
          <h3>{level.name}</h3>
        </div>
        <button type="button" className="snake-pause" onClick={onPick}>
          选择关卡
        </button>
      </div>
      <p className="snake-level-hint">{level.hint}</p>
      {phase === 'preview' && positions(level, 'P').length > 0 && (
        <p className="snake-portal-preview">
          传送预览：↑ 进入 P → ↑ 从 Q 出来。Q 也能返回 P，方向始终不变。
        </p>
      )}
      <div className="snake-adventure-stats">
        <span>
          苹果{' '}
          <strong>
            {total - state.apples.length} / {total}
          </strong>
        </span>
        <span>
          步数 <strong>{state.moves}</strong>
          {bestMoves !== undefined && <small>最佳 {bestMoves}</small>}
        </span>
        <span className={state.gem ? 'snake-gem-earned' : ''}>
          ◆ {state.gem ? '宝石到手' : '宝石可选'}
        </span>
      </div>
      <div className="snake-board-frame" ref={boardFrame}>
        <div className="snake-board" style={{ aspectRatio: '16 / 12' }}>
          <AdventureBoard level={level} state={state} />
          {phase === 'countdown' && (
            <div className="snake-countdown" role="status">
              <strong>{Math.max(1, countdown)}</strong>
              <span>准备向上出发</span>
            </div>
          )}
          {phase === 'paused' && (
            <span className="snake-paused-badge" role="status">
              已暂停 · 可以观察路线
            </span>
          )}
          {finished && (
            <div className={`snake-overlay snake-overlay-${phase}`}>
              <div
                className="snake-dialog"
                role="group"
                aria-label={phase === 'won' ? '关卡完成' : '挑战结束'}
              >
                <span className="snake-dialog-mark" aria-hidden="true">
                  {phase === 'won' ? '成' : '歇'}
                </span>
                <h3>
                  {phase === 'won'
                    ? onNext
                      ? '这一关，顺利到家'
                      : '九关走完，花园毕业！'
                    : '再试一次就更熟了'}
                </h3>
                <p>
                  {phase === 'won'
                    ? `${state.moves} 步完成 · ${state.gem ? '◆ 宝石已收集' : '还能回来寻找宝石'}`
                    : state.message}
                </p>
                {phase === 'won' && onNext && (
                  <button
                    type="button"
                    className="snake-primary"
                    disabled={!!saveError}
                    onClick={onNext}
                  >
                    下一关 →
                  </button>
                )}
                {(phase === 'lost' || !onNext) && (
                  <button
                    type="button"
                    className="snake-primary"
                    disabled={!!saveError}
                    onClick={phase === 'lost' ? begin : onPick}
                  >
                    {phase === 'lost' ? '重试本关' : '查看全部关卡'}
                  </button>
                )}
                {phase === 'won' && (
                  <button
                    type="button"
                    className="snake-replay"
                    disabled={!!saveError}
                    onClick={begin}
                  >
                    重玩本关
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="snake-adventure-message" role="status">
        {phase === 'preview' ? `吃齐 ${total} 个苹果后，前往出口 E。` : state.message}
      </p>
      <div className="snake-legend" aria-label="地图图例">
        <span>● 苹果</span>
        <span>◆ 宝石</span>
        <span>a / A 钥匙与门</span>
        <span>P ↔ Q 传送门</span>
        <span>E 出口{state.apples.length ? '待开启' : '已开启'}</span>
      </div>
      {saveError && (
        <p role="alert">
          {saveError}{' '}
          <button type="button" className="snake-pause" onClick={() => settle(stateRef.current)}>
            重试保存
          </button>
        </p>
      )}
      <footer className="snake-controls">
        <div className="snake-control-notes">
          <p>方向键 / WASD / 下方按钮控制 · 固定慢速</p>
          <p>吃齐苹果即可过关，宝石不影响下一关解锁。</p>
          {phase === 'preview' && (
            <button type="button" className="snake-primary" onClick={begin}>
              开始本关 →
            </button>
          )}
          {running && (
            <>
              <button type="button" className="snake-pause" onClick={pause}>
                {phase === 'paused' ? '继续游戏' : '暂停观察'} <kbd>空格</kbd>
              </button>{' '}
              <button type="button" className="snake-pause" onClick={begin}>
                重试本关
              </button>
            </>
          )}
        </div>
        <div className="snake-dpad" role="group" aria-label="方向控制">
          {directions.map(({ value, label, symbol }) => (
            <button
              key={value}
              type="button"
              className={`snake-direction snake-direction-${value.toLowerCase()}`}
              aria-label={label}
              disabled={phase !== 'playing'}
              data-active={state.direction === value}
              onClick={() => turn(value)}
            >
              {symbol}
            </button>
          ))}
          <span>方向控制</span>
        </div>
      </footer>
    </>
  )
}
