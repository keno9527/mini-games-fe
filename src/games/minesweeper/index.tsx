import { useGamePlay } from '@/hooks/useGamePlay'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { GameComponentProps } from '@/games/manifest'
import { useGameRecord } from '@/hooks/useGameRecord'
import {
  CONFIGS,
  createBoard,
  isCleared,
  reveal,
  toggleFlag,
  type CellState,
  type Difficulty,
} from './engine'
import './minesweeper.css'

function Icon({ name }: { name: 'flag' | 'mine' | 'restart' | 'reveal' | 'clock' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'flag' && (
        <>
          <path d="M6 21V3m0 1c4-4 7 4 12 0v10c-5 4-8-4-12 0" />
          <path d="M3 21h6" />
        </>
      )}
      {name === 'mine' && (
        <>
          <circle cx="12" cy="12" r="6" fill="currentColor" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
          <circle cx="10" cy="10" r="1.5" fill="#f5eee0" stroke="none" />
        </>
      )}
      {name === 'restart' && <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />}
      {name === 'reveal' && (
        <>
          <path d="M12 3v4m0 10v4M3 12h4m10 0h4" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
      {name === 'clock' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
    </svg>
  )
}

export default function Minesweeper(props: GameComponentProps) {
  return <Minefield key={JSON.stringify([props.gameId, props.userId])} {...props} />
}

function Minefield({ userId, gameId }: GameComponentProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('简单')
  const [board, setBoard] = useState<CellState[][] | null>(null)
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle')
  const play = useGamePlay(gameId, status === 'playing' ? 'playing' : 'idle')
  const [elapsed, setElapsed] = useState(0)
  const [mode, setMode] = useState<'reveal' | 'flag'>('reveal')
  const [lastCell, setLastCell] = useState<number | null>(null)
  const [focusCell, setFocusCell] = useState(0)
  const [message, setMessage] = useState('')
  const [boardPosition, setBoardPosition] = useState(0)
  const startTime = useRef(0)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const boardScrollRef = useRef<HTMLDivElement | null>(null)
  const record = useGameRecord({ userId, gameId })
  const cfg = CONFIGS[difficulty]
  const ended = status === 'won' || status === 'lost'
  const flagCount = board?.flat().filter((cell) => cell.flagged).length ?? 0
  const revealedCount = board?.flat().filter((cell) => cell.revealed && !cell.mine).length ?? 0
  const safeCount = cfg.rows * cfg.cols - cfg.mines
  const progress = Math.round((revealedCount / safeCount) * 100)
  const score = Math.max(0, 1000 - elapsed * 3 + cfg.mines * 5)

  useEffect(() => {
    if (status !== 'playing') return
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)),
      500,
    )
    return () => clearInterval(timer)
  }, [status])

  const reset = () => {
    setBoard(null)
    setStatus('idle')
    setElapsed(0)
    setMode('reveal')
    setLastCell(null)
    setFocusCell(0)
    setMessage('')
    setBoardPosition(0)
    record.reset()
  }

  const moveBoardTo = (position: number) => {
    const scroll = boardScrollRef.current
    if (!scroll) return
    const maxScroll = scroll.scrollWidth - scroll.clientWidth
    scroll.scrollTo({ left: maxScroll * (position / 2), behavior: 'smooth' })
    setBoardPosition(position)
  }

  const flag = (r: number, c: number) => {
    if (ended) return
    if (!board) {
      setMessage('先揭开一格，开始后即可插旗。')
      return
    }
    setBoard(toggleFlag(board, r, c))
    setMessage('')
  }

  const open = (r: number, c: number) => {
    if (ended) return
    if (mode === 'flag' && status !== 'idle') {
      flag(r, c)
      return
    }
    if (board?.[r][c].revealed || board?.[r][c].flagged) return
    setMessage('')
    setLastCell(r * cfg.cols + c)
    let working = board
    if (!working) {
      working = createBoard(cfg.rows, cfg.cols, cfg.mines, r, c)
      startTime.current = Date.now()
      play.start()
      record.start()
      setElapsed(0)
    }
    const duration = Math.floor((Date.now() - startTime.current) / 1000)
    if (working[r][c].mine) {
      setBoard(
        working.map((row) => row.map((cell) => (cell.mine ? { ...cell, revealed: true } : cell))),
      )
      setStatus('lost')
      play.stop()
      setElapsed(duration)
      void record.submit({ result: 'lose', duration, score: 0 })
      return
    }
    const next = reveal(working, r, c)
    if (isCleared(next)) {
      setBoard(
        next.map((row) => row.map((cell) => (cell.mine ? { ...cell, flagged: true } : cell))),
      )
      setStatus('won')
      play.stop()
      setElapsed(duration)
      void record.submit({
        result: 'win',
        duration,
        score: Math.max(0, 1000 - duration * 3 + cfg.mines * 5),
      })
    } else {
      setBoard(next)
      setStatus('playing')
    }
  }

  const statusTitle = {
    idle: '从容落下第一步',
    playing: mode === 'flag' ? '标记你的判断' : '线索，就在数字之间',
    won: '雷区已清，漂亮！',
    lost: '停一步，再推敲',
  }[status]
  const statusText = {
    idle: '任选一格开始。首格及周围八格均无雷，放心打开你的第一片空地。',
    playing:
      mode === 'flag'
        ? '点击未揭开的格子插旗，再点一次取消。切回「揭开」继续探索。'
        : '数字表示周围八格的地雷数。先找确定的安全格，再处理未知区域。',
    won: `全部 ${safeCount} 个安全格已揭开，本局获得 ${score} 分。`,
    lost: '红色标出了触雷位置，地雷已全部显示。带叉的旗帜是本局的误标。',
  }[status]

  return (
    <section
      className="ms-game"
      data-difficulty={difficulty}
      data-status={status}
      aria-label="扫雷游戏"
    >
      <header className="ms-heading">
        <div>
          <span className="ms-eyebrow">慢一点，让每一步都有把握</span>
          <h2>
            静野 <span>扫雷研习室</span>
          </h2>
        </div>
        <div className="ms-seal" aria-hidden="true">
          <Icon name="mine" />
          <span>MINESWEEPER</span>
        </div>
      </header>
      <div className="ms-difficulties" role="group" aria-label="难度">
        {(Object.keys(CONFIGS) as Difficulty[]).map((item, index) => (
          <button
            type="button"
            key={item}
            aria-pressed={difficulty === item}
            onClick={() => {
              if (item !== difficulty) {
                setDifficulty(item)
                reset()
              }
            }}
          >
            <span className="ms-difficulty-index">0{index + 1}</span>
            <span>
              <strong>{item}</strong>
              <small>
                {CONFIGS[item].rows} × {CONFIGS[item].cols} <span>·</span> {CONFIGS[item].mines} 雷
              </small>
            </span>
            <span className="ms-choice-dot" />
          </button>
        ))}
      </div>

      <div className="ms-play">
        <div className="ms-field-column">
          <div className="ms-instruments">
            <div>
              <span>
                <Icon name="flag" /> 待标记
              </span>
              <strong className={flagCount > cfg.mines ? 'ms-overflagged' : ''}>
                {String(cfg.mines - flagCount).padStart(3, '0')}
              </strong>
            </div>
            <button
              type="button"
              className="ms-reset-dial"
              onClick={reset}
              aria-label="重新开始本局"
              title="重新开始本局"
            >
              <Icon name="restart" />
            </button>
            <div className="ms-time">
              <span>
                <Icon name="clock" /> 用时
              </span>
              <strong>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}
                <i>:</i>
                {String(elapsed % 60).padStart(2, '0')}
              </strong>
            </div>
          </div>
          <div className="ms-board-frame">
            <span className="ms-screw top-left" />
            <span className="ms-screw top-right" />
            <span className="ms-screw bottom-left" />
            <span className="ms-screw bottom-right" />
            <div
              className="ms-board-scroll"
              ref={boardScrollRef}
              tabIndex={difficulty === '简单' ? -1 : 0}
              role="region"
              aria-label="雷区，大棋盘可左右滚动"
              key={difficulty}
              onScroll={(event) => {
                if (difficulty !== '复杂') return
                const { clientWidth, scrollLeft, scrollWidth } = event.currentTarget
                const maxScroll = scrollWidth - clientWidth
                setBoardPosition(maxScroll > 0 ? Math.round((scrollLeft / maxScroll) * 2) : 0)
              }}
            >
              <div
                className={`ms-board ${difficulty === '简单' ? 'ms-board-small' : ''}`}
                role="group"
                aria-label={`${cfg.rows} 行 ${cfg.cols} 列扫雷棋盘`}
                style={
                  {
                    '--ms-columns': cfg.cols,
                  } as CSSProperties
                }
              >
                {Array.from({ length: cfg.rows * cfg.cols }, (_, index) => {
                  const r = Math.floor(index / cfg.cols),
                    c = index % cfg.cols
                  const cell = board?.[r][c]
                  const visibleMine = cell?.mine && cell.revealed
                  const exploded = visibleMine && lastCell === index
                  const wrongFlag = status === 'lost' && cell?.flagged && !cell.mine
                  const content = visibleMine
                    ? '地雷'
                    : wrongFlag
                      ? '误标旗帜'
                      : cell?.flagged
                        ? '已插旗'
                        : cell?.revealed
                          ? cell.adjacent
                            ? `周围 ${cell.adjacent} 雷`
                            : '空地'
                          : '未揭开'
                  return (
                    <button
                      type="button"
                      key={index}
                      ref={(node) => {
                        cellRefs.current[index] = node
                      }}
                      tabIndex={focusCell === index ? 0 : -1}
                      onFocus={() => setFocusCell(index)}
                      aria-label={`第 ${r + 1} 行第 ${c + 1} 列，${content}`}
                      disabled={ended}
                      onClick={() => open(r, c)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        flag(r, c)
                      }}
                      onKeyDown={(event) => {
                        if (event.key.toLowerCase() === 'f') {
                          event.preventDefault()
                          flag(r, c)
                          return
                        }
                        const delta = (
                          {
                            ArrowLeft: -1,
                            ArrowRight: 1,
                            ArrowUp: -cfg.cols,
                            ArrowDown: cfg.cols,
                          } as Record<string, number>
                        )[event.key]
                        if (!delta) return
                        event.preventDefault()
                        const next = index + delta
                        if (
                          next >= 0 &&
                          next < cfg.rows * cfg.cols &&
                          (Math.abs(delta) === cfg.cols || Math.floor(next / cfg.cols) === r)
                        )
                          cellRefs.current[next]?.focus()
                      }}
                      className={`ms-cell ${cell?.revealed ? 'is-revealed' : 'is-covered'} ${cell?.flagged && !visibleMine ? 'is-flagged' : ''} ${visibleMine ? 'is-mine' : ''} ${exploded ? 'is-exploded' : ''} ${wrongFlag ? 'is-wrong' : ''} ${lastCell === index && cell?.revealed && !cell.mine ? 'is-latest' : ''}`}
                      data-number={cell?.revealed ? cell.adjacent : undefined}
                    >
                      {visibleMine ? (
                        <Icon name="mine" />
                      ) : cell?.flagged ? (
                        <Icon name="flag" />
                      ) : cell?.revealed && cell.adjacent > 0 ? (
                        cell.adjacent
                      ) : null}
                      {wrongFlag && <span className="ms-wrong-cross" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="ms-board-caption">
            <span>
              {cfg.rows} × {cfg.cols} 格 · {cfg.mines} 枚地雷
            </span>
            <span>{difficulty === '简单' ? '首步安全开局' : '左右滑动查看完整雷区 ↔'}</span>
          </div>
          <div className="ms-mode-bar" role="group" aria-label="点击操作模式">
            <button
              type="button"
              aria-pressed={mode === 'reveal'}
              disabled={ended}
              onClick={() => {
                setMode('reveal')
                setMessage('')
              }}
            >
              <Icon name="reveal" /> 揭开
            </button>
            <button
              type="button"
              aria-pressed={mode === 'flag'}
              disabled={status === 'idle' || ended}
              onClick={() => {
                setMode('flag')
                setMessage('')
              }}
            >
              <Icon name="flag" /> 插旗
            </button>
            <span>
              {ended
                ? '本局已结束'
                : status === 'idle'
                  ? '点击棋盘开始'
                  : mode === 'flag'
                    ? '点击格子标记 / 取消'
                    : '也可右键插旗'}
            </span>
          </div>
          {difficulty === '复杂' && (
            <div className="ms-board-nav" role="group" aria-label="棋盘区域快速定位">
              {['左侧', '中部', '右侧'].map((label, position) => (
                <button
                  type="button"
                  key={label}
                  aria-pressed={boardPosition === position}
                  onClick={() => moveBoardTo(position)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="ms-sidebar">
          <div className={`ms-status ms-status-${status}`} role="status" aria-live="polite">
            <span className="ms-eyebrow">
              {status === 'won' ? '探索完成' : status === 'lost' ? '本局结束' : '本局手记'}
            </span>
            <h3>{statusTitle}</h3>
            <p>{statusText}</p>
          </div>
          <div className="ms-exploration">
            <div>
              <span>探索进度</span>
              <strong>
                {progress}
                <small>%</small>
              </strong>
            </div>
            <div
              className="ms-progress-track"
              role="progressbar"
              aria-label="安全格探索进度"
              aria-valuemin={0}
              aria-valuemax={safeCount}
              aria-valuenow={revealedCount}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <p>
              已揭开 <b>{revealedCount}</b> / {safeCount} 个安全格
            </p>
          </div>
          <button type="button" className="ms-new-game" onClick={reset}>
            <Icon name="restart" /> {ended ? '再来一局' : '重新开局'}
          </button>
          <p className="ms-live-note" role="status">
            {message ||
              (flagCount > cfg.mines
                ? '旗帜数已超过地雷总数，检查一下标记。'
                : status === 'idle'
                  ? '无需抢时间，先找到你的节奏。'
                  : '旗帜只是标记，揭开全部安全格即可获胜。')}
          </p>
          <details className="ms-help">
            <summary>怎么玩？</summary>
            <p>
              <b>看数字</b> · 数字表示周围八格共有几枚地雷，空白区域会自动展开。
            </p>
            <p>
              <b>做标记</b> · 右键插旗；触屏可切换「插旗」模式。再标记一次即可取消。
            </p>
            <p>
              <b>键盘操作</b> · 方向键移动，Enter / 空格执行当前模式，F 键插旗。
            </p>
            <p>
              <b>赢下本局</b> · 揭开所有安全格即可获胜。
              {userId ? '完成后自动记录成绩。' : '选择玩家后可保存成绩。'}
            </p>
          </details>
        </aside>
      </div>
      <footer className="ms-footer">
        <span>每一个数字，都是一条线索。</span>
        <span>观察 · 推理 · 落定</span>
      </footer>
    </section>
  )
}
