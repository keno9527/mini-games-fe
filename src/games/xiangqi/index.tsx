import { useGamePlay } from '@/hooks/useGamePlay'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  X,
  ArrowCounterClockwise,
  ArrowUUpLeft,
  Lightbulb,
} from '@phosphor-icons/react'
import type { GameComponentProps } from '@/games/manifest'
import { useGameRecord } from '@/hooks/useGameRecord'
import {
  isInCheck,
  legalMoves,
  pieceName,
  sideOf,
  squareName,
  type Move,
  type SearchResult,
} from './engine'
import { levels, type Level } from './levels'
import { readProgress, saveProgress, unlockedLevel } from './progression'
import { newSession, sessionReducer } from './session'
import './xiangqi.css'

export default function Xiangqi(props: GameComponentProps) {
  return <Campaign key={JSON.stringify([props.gameId, props.userId])} {...props} />
}

function Campaign({ gameId, userId }: GameComponentProps) {
  const [progress, setProgress] = useState(() => readProgress(gameId, userId))
  const [current, setCurrent] = useState(() => unlockedLevel(progress))
  const [attempt, setAttempt] = useState(0)
  const [saveError, setSaveError] = useState(false)
  const unlocked = unlockedLevel(progress)
  const rulesDialog = useRef<HTMLDialogElement>(null)
  const complete = useCallback((id: string, stars: number) => {
    setProgress((previous) => ({ ...previous, [id]: Math.max(previous[id] ?? 0, stars) }))
  }, [])

  useEffect(() => {
    setSaveError(!saveProgress(gameId, userId, progress))
  }, [gameId, userId, progress])

  return (
    <section className="xq-game" aria-label="中国象棋残局闯关">
      <nav className="xq-campaign-toolbar" aria-label="选择关卡">
        <button
          type="button"
          className="xq-level-arrow"
          aria-label="上一关"
          disabled={current === 0}
          onClick={() => setCurrent(current - 1)}
        >
          <CaretLeft size={18} />
        </button>
        <label className="xq-level-select">
          选关
          <span className="xq-level-picker">
            <span className="xq-selected-number" aria-hidden="true">
              {String(current + 1).padStart(2, '0')}
              <CaretDown size={12} />
            </span>
            <select
              aria-label="当前关卡"
              value={current}
              onChange={(event) => setCurrent(Number(event.target.value))}
            >
              {levels.map((level, i) => (
                <option key={level.id} value={i} disabled={i > unlocked}>
                  {String(i + 1).padStart(2, '0')} · {level.name}
                  {i > unlocked ? '（未解锁）' : ''}
                </option>
              ))}
            </select>
          </span>
          <span>/ {String(levels.length).padStart(2, '0')}</span>
        </label>
        <button
          type="button"
          className="xq-level-arrow"
          aria-label="下一关"
          disabled={current >= unlocked}
          onClick={() => setCurrent(current + 1)}
        >
          <CaretRight size={18} />
        </button>
        <div className="xq-level-dots">
          {levels.map((level, i) => (
            <button
              type="button"
              key={level.id}
              aria-label={`第 ${i + 1} 关 ${level.name}${i > unlocked ? '，未解锁' : ''}`}
              aria-current={current === i ? 'step' : undefined}
              disabled={i > unlocked}
              className={progress[level.id] ? 'is-complete' : ''}
              onClick={() => setCurrent(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="xq-rules-button"
          onClick={() => rulesDialog.current?.showModal()}
        >
          规则
        </button>
      </nav>
      <dialog ref={rulesDialog} className="xq-rules-dialog" aria-labelledby="xq-rules-title">
        <div className="xq-rules-heading">
          <h2 id="xq-rules-title">棋局思路与规则</h2>
          <button type="button" aria-label="关闭规则" onClick={() => rulesDialog.current?.close()}>
            <X size={22} />
          </button>
        </div>
        <p>{levels[current].tip}</p>
        <p>
          车走直线；马走日，留意蹩腿；相走田，不越河、不能塞眼；炮隔一子吃子；仕、帅不出九宫；兵过河可横走，不能后退。
        </p>
        <p>
          必须应将，不可送将或让将帅照面。将死或困毙黑方均获胜。此模式为限定步数残局，不采用长局循环裁定。
        </p>
        <p>
          红方落子一次计 1 步，黑方应对不计步。悔棋回退一整个回合。独立过关获 3
          星；使用提示、使用悔棋各减 1 星，最低 1 星。
        </p>
        <p>进度自动保存在此浏览器，每关最高 300 分。</p>
      </dialog>
      <Puzzle
        key={`${current}:${attempt}`}
        level={levels[current]}
        gameId={gameId}
        userId={userId}
        onComplete={complete}
        onRetry={() => setAttempt((value) => value + 1)}
        onNext={current < levels.length - 1 ? () => setCurrent(current + 1) : undefined}
      />
      {saveError && (
        <p className="xq-storage" role="status">
          浏览器未能保存进度；本次仍可继续，刷新后可能丢失。
        </p>
      )}
    </section>
  )
}

interface PuzzleProps extends GameComponentProps {
  level: Level
  onComplete: (id: string, stars: number) => void
  onRetry: () => void
  onNext?: () => void
}

function Puzzle({ level, gameId, userId, onComplete, onRetry, onNext }: PuzzleProps) {
  const [session, dispatch] = useReducer(sessionReducer, level, newSession)
  const play = useGamePlay(gameId)
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<Move | null>(null)
  const [hintRequested, setHintRequested] = useState(false)
  const [usedHint, setUsedHint] = useState(false)
  const [usedUndo, setUsedUndo] = useState(false)
  const [note, setNote] = useState('点击红方棋子，再点击标出的落点。')
  const [focusSquare, setFocusSquare] = useState(() =>
    level.board.findIndex((p) => p && sideOf(p) === 'red'),
  )
  const squares = useRef<(HTMLButtonElement | null)[]>([])
  const { start, submit } = useGameRecord({ gameId, userId })
  const { board, phase, moves, lastMove } = session
  const possible = useMemo(() => legalMoves(board, 'red'), [board])
  const destinations = possible.filter((move) => move.from === selected).map((move) => move.to)
  const ended = phase === 'won' || phase === 'lost'
  const checked = !ended && isInCheck(board, phase)
  const stars = 3 - Number(usedHint) - Number(usedUndo)

  useEffect(() => {
    start()
  }, [start])
  useEffect(() => {
    if (!ended) return
    play.stop()
    if (phase === 'won') onComplete(level.id, stars)
    void submit({
      score: phase === 'won' ? stars * 100 : 0,
      result: phase === 'won' ? 'win' : 'lose',
    })
  }, [ended, phase, level.id, stars, onComplete, submit, play])

  useEffect(() => {
    if (phase !== 'black' && !(phase === 'red' && hintRequested)) return
    let worker: Worker | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let finished = false
    const finish = (result?: SearchResult) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      worker?.terminate()
      if (phase === 'black') {
        const move = result?.move ?? legalMoves(board, 'black')[0]
        if (move) dispatch({ type: 'move', move })
        setNote(result ? '黑方已落子，轮到你了。' : '计算暂不可用，黑方已采用合法应对。')
      } else {
        setHintRequested(false)
        if (result?.proof === 'win' && result.move) {
          setHint(result.move)
          setSelected(result.move.from)
          setNote(
            `建议：${pieceName(board[result.move.from]!)} ${squareName(result.move.from)} → ${squareName(result.move.to)}。金色方框标出落点。`,
          )
        } else
          setNote(
            result?.proof === 'escape'
              ? '当前局面无法在剩余步数内强制取胜，试试悔棋或重来。'
              : '暂未算出可靠提示，可以继续走棋或重试提示。',
          )
      }
    }
    try {
      worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<SearchResult>) => finish(event.data)
      worker.onerror = () => finish()
      timer = setTimeout(() => finish(), 8000)
      worker.postMessage({ board, side: phase, remaining: level.moves - moves })
    } catch {
      finish()
    }
    return () => {
      finished = true
      clearTimeout(timer)
      worker?.terminate()
    }
  }, [board, phase, moves, level.moves, hintRequested])

  const onSquare = (square: number) => {
    if (phase !== 'red' || hintRequested) return
    const piece = board[square]
    if (piece && sideOf(piece) === 'red') {
      setSelected(selected === square ? null : square)
      setHint(null)
      setNote(
        possible.some((move) => move.from === square)
          ? '绿色圆点可落子，圆环可吃子。'
          : '这枚棋子当前没有合法落点，请选择其他红子。',
      )
    } else if (selected !== null && destinations.includes(square)) {
      play.start()
      dispatch({ type: 'move', move: { from: selected, to: square } })
      setSelected(null)
      setHint(null)
      setNote('')
    } else
      setNote(
        selected === null
          ? '请先选择一枚红方棋子。'
          : '此处不能落子：需遵守棋子走法，并确保红帅安全。',
      )
  }

  return (
    <>
      <div className="xq-stage-heading">
        <h3>{level.name}</h3>
        <span className="xq-objective">{level.moves} 步内取胜</span>
      </div>
      <div className="xq-play">
        <div className="xq-board-column">
          <div className="xq-board-frame">
            <div
              className="xq-board"
              role="group"
              aria-label="象棋棋盘，黑上红下，列 A 至 I，行从上至下 10 至 1"
            >
              <svg viewBox="0 0 450 500" aria-hidden="true" className="xq-lines">
                <rect x="25" y="25" width="400" height="450" fill="none" strokeWidth="2" />
                {Array.from({ length: 10 }, (_, i) => (
                  <line key={`h${i}`} x1="25" y1={25 + 50 * i} x2="425" y2={25 + 50 * i} />
                ))}
                {Array.from({ length: 7 }, (_, i) => (
                  <g key={`v${i}`}>
                    <line x1={75 + i * 50} y1="25" x2={75 + i * 50} y2="225" />
                    <line x1={75 + i * 50} y1="275" x2={75 + i * 50} y2="475" />
                  </g>
                ))}
                <path d="M175 25 L275 125 M275 25 L175 125 M175 375 L275 475 M275 375 L175 475" />
                <text x="125" y="257">
                  楚 河
                </text>
                <text x="325" y="257">
                  汉 界
                </text>
                {Array.from({ length: 10 }, (_, i) => (
                  <text className="xq-rank" key={i} x="6" y={28 + i * 50}>
                    {10 - i}
                  </text>
                ))}
              </svg>
              <div className="xq-squares">
                {board.map((piece, square) => {
                  const target = destinations.includes(square)
                  const isChecked = piece?.toUpperCase() === 'K' && isInCheck(board, sideOf(piece))
                  return (
                    <button
                      key={square}
                      type="button"
                      ref={(node) => {
                        squares.current[square] = node
                      }}
                      tabIndex={square === focusSquare ? 0 : -1}
                      disabled={phase !== 'red' || hintRequested}
                      onFocus={() => setFocusSquare(square)}
                      onClick={() => onSquare(square)}
                      onKeyDown={(event) => {
                        const delta = (
                          { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 } as Record<
                            string,
                            number
                          >
                        )[event.key]
                        if (!delta) return
                        event.preventDefault()
                        const next = square + delta
                        if (
                          next >= 0 &&
                          next < 90 &&
                          (Math.abs(delta) === 9 || Math.floor(next / 9) === Math.floor(square / 9))
                        )
                          squares.current[next]?.focus()
                      }}
                      aria-label={`${piece ? `${sideOf(piece) === 'red' ? '红' : '黑'}${pieceName(piece)}` : '空位'} ${squareName(square)}${target ? '，可落子' : ''}`}
                      aria-pressed={selected === square}
                      className={`xq-square ${selected === square ? 'is-selected' : ''} ${target ? 'is-target' : ''} ${hint?.to === square ? 'is-hint' : ''} ${lastMove?.to === square || lastMove?.from === square ? 'is-last' : ''}`}
                    >
                      {piece ? (
                        <span
                          className={`xq-piece ${sideOf(piece)} ${isChecked ? 'in-check' : ''}`}
                        >
                          {pieceName(piece)}
                        </span>
                      ) : target ? (
                        <span className="xq-dot" />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="xq-files" aria-hidden="true">
              {'ABCDEFGHI'.split('').map((file) => (
                <span key={file}>{file}</span>
              ))}
            </div>
          </div>
        </div>
        <div className={`xq-controls ${ended ? 'is-ended' : ''}`}>
          <div className="xq-status" role="status" aria-live="polite">
            <h4>
              {phase === 'won'
                ? '破局成功'
                : phase === 'lost'
                  ? '再推演一次'
                  : hintRequested
                    ? '推演提示中…'
                    : phase === 'black'
                      ? '黑方思考中…'
                      : checked
                        ? '将军！请应将'
                        : '轮到红方'}
            </h4>
            {ended ? (
              <>
                <p>{session.reason}</p>
                {phase === 'won' && (
                  <>
                    <div className="xq-stars" aria-label={`${stars} 星`}>
                      {'★'.repeat(stars)}
                      {'☆'.repeat(3 - stars)}
                    </div>
                    <p>
                      {stars * 100} 分 ·{' '}
                      {onNext ? '下一关已解锁' : '全部残局已解锁，恭喜完成挑战！'}
                    </p>
                  </>
                )}
              </>
            ) : null}
            <div className="xq-move-count">
              <strong>
                {moves}
                <small> / {level.moves}</small>
              </strong>
              <span>步</span>
            </div>
          </div>
          <div className="xq-actions">
            {phase === 'won' && onNext && (
              <button type="button" className="xq-primary" onClick={onNext}>
                下一关 →
              </button>
            )}
            <button type="button" onClick={onRetry} className="xq-primary xq-retry">
              <ArrowCounterClockwise size={18} aria-hidden="true" />
              {ended ? '重新挑战' : '重来'}
            </button>
            <div>
              <button
                type="button"
                disabled={ended || !session.history.length || hintRequested}
                onClick={() => {
                  dispatch({ type: 'undo' })
                  setUsedUndo(true)
                  setSelected(null)
                  setHint(null)
                  setNote('已退回你上一次落子前，可重新选择。')
                }}
              >
                <ArrowUUpLeft size={18} aria-hidden="true" /> 悔棋
              </button>
              <button
                type="button"
                disabled={phase !== 'red' || hintRequested}
                onClick={() => {
                  setUsedHint(true)
                  setHintRequested(true)
                  setHint(null)
                }}
              >
                <Lightbulb size={18} aria-hidden="true" /> {hintRequested ? '推演中' : '提示'}
              </button>
            </div>
          </div>
          <p className="xq-note" role="status">
            {ended ? '可以重玩已解锁关卡，刷新最佳星级。' : note}
          </p>
        </div>
      </div>
    </>
  )
}
