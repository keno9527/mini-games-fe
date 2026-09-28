import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { GameComponentProps } from '@/games/manifest'
import { useGameRecord } from '@/hooks/useGameRecord'
import { readLogicProgress, saveLogicProgress, resumeLogicLevel } from './progression'
import { useGamePlay } from '@/hooks/useGamePlay'
import { isCleared, reveal, toggleFlag } from './engine'
import { LOGIC_LEVELS, type LogicLevel } from './levels'
import {
  CHAPTERS,
  LESSONS,
  chapterUnlocked,
  completeLevel,
  coordinate,
  createLogicBoard,
  findLogicHint,
  type LogicHint,
} from './logic'

export function LogicCampaign({ userId, gameId }: GameComponentProps) {
  const [progress, setProgress] = useState(() => readLogicProgress(gameId, userId))
  const [saveError, setSaveError] = useState(false)
  const [selected, setSelected] = useState(() => resumeLogicLevel(progress))
  const [attempt, setAttempt] = useState(0)
  const picker = useRef<HTMLDetailsElement>(null)
  const chapterIndex = Math.floor((selected - 1) / 5)
  const choose = (id: number) => {
    if (id !== selected) {
      setSelected(id)
      setAttempt((a) => a + 1)
    }
    if (picker.current) {
      picker.current.open = false
      picker.current.querySelector('summary')?.focus()
    }
  }
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (picker.current && !picker.current.contains(event.target as Node))
        picker.current.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  const count = Object.values(progress).filter((p) => p.completed).length
  const finish = (unaided: boolean) => {
    const next = completeLevel(readLogicProgress(gameId, userId), selected, unaided)
    setProgress(next)
    try {
      saveLogicProgress(gameId, userId, next)
      setSaveError(false)
    } catch {
      setSaveError(true)
    }
  }
  return (
    <section className="ms-game ms-logic" data-difficulty="简单" aria-label="逻辑闯关">
      <div className="ms-selection-bar">
        <span className="ms-chapter-label">
          第 {chapterIndex + 1} 章 · {CHAPTERS[chapterIndex]}
        </span>
        <details
          className="ms-picker"
          ref={picker}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && picker.current) {
              picker.current.open = false
              picker.current.querySelector('summary')?.focus()
            }
          }}
        >
          <summary aria-label="选择关卡">
            {String(selected).padStart(2, '0')} · {LOGIC_LEVELS[selected - 1].name}
            <span aria-hidden="true"> ▾</span>
          </summary>
          <div className="ms-picker-panel">
            <p className="ms-picker-progress">已完成 {count} / 20 关</p>
            {CHAPTERS.map((name, chapter) => {
              const unlocked = chapterUnlocked(chapter, progress)
              const levels = LOGIC_LEVELS.slice(chapter * 5, chapter * 5 + 5)
              const completed = levels.filter((l) => progress[l.id]?.completed).length
              return (
                <section key={name}>
                  <h3>
                    {chapter + 1}. {name}{' '}
                    <small>
                      {unlocked
                        ? `${completed} / 5${completed === 5 ? ' · 本章完成' : ''}`
                        : '待解锁'}
                    </small>
                  </h3>
                  {!unlocked && <p>完成上一章任意 4 关，或通过上一章第 5 关结业题。</p>}
                  <div className="ms-level-list">
                    {levels.map((level) => (
                      <button
                        key={level.id}
                        disabled={!unlocked}
                        aria-pressed={selected === level.id}
                        onClick={() => choose(level.id)}
                      >
                        <span>
                          {String(level.id).padStart(2, '0')} · {level.name}
                        </span>
                        <small>
                          {progress[level.id]?.unaided
                            ? '✦ 无提示通关'
                            : progress[level.id]?.completed
                              ? '✓ 已通关'
                              : `${level.rows} × ${level.cols} · ${level.mines.length} 雷`}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
            <p className="ms-picker-note">
              {userId ? '通关后保存至玩家档案。' : '访客进度保存在本机。'}换关会重置当前盘面。
            </p>
          </div>
        </details>
        <div className="ms-level-arrows">
          <button
            aria-label="上一关"
            disabled={selected === 1}
            onClick={() => choose(selected - 1)}
          >
            ←
          </button>
          <button
            aria-label="下一关"
            disabled={selected === 20 || !chapterUnlocked(Math.floor(selected / 5), progress)}
            onClick={() => choose(selected + 1)}
          >
            →
          </button>
        </div>
      </div>
      <LogicRound
        key={`${selected}:${attempt}`}
        gameId={gameId}
        userId={userId}
        level={LOGIC_LEVELS[selected - 1]}
        onComplete={finish}
        onRetry={() => setAttempt((a) => a + 1)}
        onNext={
          selected < 20 && chapterUnlocked(Math.floor(selected / 5), progress)
            ? () => {
                setSelected(selected + 1)
                setAttempt((a) => a + 1)
              }
            : undefined
        }
      />
      {saveError && (
        <p className="ms-live-note" role="alert">
          进度暂存失败，请检查玩家档案或存储状态后重试。
        </p>
      )}
    </section>
  )
}

function LogicRound({
  level,
  gameId,
  userId,
  onComplete,
  onRetry,
  onNext,
}: {
  level: LogicLevel
  gameId: string
  userId?: string
  onComplete: (unaided: boolean) => void
  onRetry: () => void
  onNext?: () => void
}) {
  const [board, setBoard] = useState(() => createLogicBoard(level))
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost' | 'learning'>('idle')
  const [showHelp, setShowHelp] = useState(false)
  const [mode, setMode] = useState<'reveal' | 'flag'>('reveal')
  const [elapsed, setElapsed] = useState(0)
  const [hint, setHint] = useState<LogicHint | null>(null)
  const [hintTier, setHintTier] = useState(0)
  const [usedHint, setUsedHint] = useState(false)
  const [region, setRegion] = useState<number | null>(null)
  const [focus, setFocus] = useState(0)
  const [exploded, setExploded] = useState<number | null>(null)
  const record = useGameRecord({ userId, gameId })
  const start = useRef(0)
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  const play = useGamePlay(gameId, status === 'playing' ? 'playing' : 'idle')
  const ended = status === 'won' || status === 'lost' || status === 'learning'
  useEffect(() => {
    if (status !== 'playing') return
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start.current) / 1000)),
      1000,
    )
    return () => clearInterval(timer)
  }, [status])
  const begin = () => {
    if (status === 'idle') {
      start.current = Date.now()
      setStatus('playing')
      play.start()
      record.start()
    }
  }
  const clearHint = () => {
    setHint(null)
    setHintTier(0)
  }
  const flag = (index: number) => {
    if (ended || board[Math.floor(index / level.cols)][index % level.cols].revealed) return
    begin()
    setBoard(toggleFlag(board, Math.floor(index / level.cols), index % level.cols))
    clearHint()
  }
  const open = (index: number) => {
    if (ended) return
    if (mode === 'flag') {
      flag(index)
      return
    }
    const r = Math.floor(index / level.cols),
      c = index % level.cols
    if (board[r][c].revealed || board[r][c].flagged) return
    begin()
    clearHint()
    if (board[r][c].mine) {
      setExploded(index)
      setStatus('lost')
      play.stop()
      return
    }
    const next = reveal(board, r, c)
    setBoard(next)
    if (isCleared(next)) {
      setStatus('won')
      play.stop()
      setElapsed(Math.floor((Date.now() - start.current) / 1000))
      onComplete(!usedHint)
      void record.submit({
        result: 'win',
        level: level.id,
        score: 0,
        duration: Math.floor((Date.now() - start.current) / 1000),
      })
    }
  }
  const requestHint = () => {
    begin()
    setUsedHint(true)
    if (!hint) setHint(findLogicHint(board, level))
    setHintTier((t) => Math.min(3, t + 1))
  }
  return (
    <div className="ms-compact-round" data-status={status}>
      <div className="ms-round-stats">
        <span>
          总雷数 {level.mines.length} · 已插旗 {board.flat().filter((c) => c.flagged).length}
        </span>
        <span>
          用时 {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
          {String(elapsed % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="ms-board-frame">
        <div
          className="ms-coordinate-cols"
          style={{ gridTemplateColumns: `repeat(${level.cols}, 1fr)` }}
        >
          {Array.from({ length: level.cols }, (_, c) => (
            <span key={c}>{String.fromCharCode(65 + c)}</span>
          ))}
        </div>
        <div className="ms-coordinate-field">
          <div className="ms-coordinate-rows">
            {Array.from({ length: level.rows }, (_, r) => (
              <span key={r}>{r + 1}</span>
            ))}
          </div>
          <div
            className="ms-board ms-board-small"
            role="group"
            aria-label={`${level.name}，${level.rows} 行 ${level.cols} 列`}
            style={{ '--ms-columns': level.cols } as CSSProperties}
          >
            {board.flat().map((cell, index) => {
              const showMine = exploded === index || (status === 'learning' && cell.mine)
              const showNumber = cell.revealed || (status === 'learning' && !cell.mine)
              const highlighted =
                (hintTier > 0 && hint?.focus.includes(index)) ||
                (region !== null && level.extras[region].cells.includes(index))
              return (
                <button
                  key={index}
                  ref={(node) => {
                    cells.current[index] = node
                  }}
                  tabIndex={focus === index ? 0 : -1}
                  onFocus={() => setFocus(index)}
                  disabled={ended}
                  aria-label={`${coordinate(index, level.cols)}，${showMine ? '地雷' : cell.flagged ? '已插旗' : showNumber ? `${cell.adjacent} 雷` : '未揭开'}`}
                  onClick={() => open(index)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    flag(index)
                  }}
                  onKeyDown={(e) => {
                    if (e.key.toLowerCase() === 'f') {
                      e.preventDefault()
                      flag(index)
                      return
                    }
                    const delta = (
                      {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -level.cols,
                        ArrowDown: level.cols,
                      } as Record<string, number>
                    )[e.key]
                    if (!delta) return
                    e.preventDefault()
                    const next = index + delta
                    if (
                      next >= 0 &&
                      next < level.rows * level.cols &&
                      (Math.abs(delta) === level.cols ||
                        Math.floor(next / level.cols) === Math.floor(index / level.cols))
                    )
                      cells.current[next]?.focus()
                  }}
                  className={`ms-cell ${showNumber || showMine ? 'is-revealed' : 'is-covered'} ${cell.flagged && !showMine ? 'is-flagged' : ''} ${exploded === index ? 'is-exploded' : ''} ${highlighted ? 'ms-highlight' : ''}`}
                  data-number={showNumber ? cell.adjacent : undefined}
                >
                  {showMine
                    ? '✹'
                    : status !== 'learning' && cell.flagged
                      ? '⚑'
                      : showNumber && cell.adjacent > 0
                        ? cell.adjacent
                        : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="ms-compact-tools" role="group" aria-label="棋盘操作">
        <button disabled={ended} aria-pressed={mode === 'reveal'} onClick={() => setMode('reveal')}>
          揭开
        </button>
        <button disabled={ended} aria-pressed={mode === 'flag'} onClick={() => setMode('flag')}>
          插旗
        </button>
        <button
          disabled={ended}
          aria-expanded={hintTier > 0}
          onClick={() => (hintTier > 0 ? clearHint() : requestHint())}
          title="使用提示会影响本轮无提示徽章"
        >
          提示
        </button>
        <button onClick={onRetry}>重试</button>
        <button
          aria-label="规则与操作"
          aria-expanded={showHelp}
          onClick={() => setShowHelp((v) => !v)}
        >
          ?
        </button>
      </div>
      {level.extras.length > 0 && (
        <div className="ms-extra-clues">
          <h4>额外线索 · 点击高亮范围</h4>
          {level.extras.map((extra, i) => (
            <button
              key={extra.name}
              aria-pressed={region === i}
              onClick={() => setRegion(region === i ? null : i)}
            >
              {extra.name}：{coordinate(extra.cells[0], level.cols)}—
              {coordinate(extra.cells[extra.cells.length - 1], level.cols)} 共 {extra.count} 雷
            </button>
          ))}
          <p>范围包含边界；相交格分别计入各条线索。</p>
        </div>
      )}
      {ended && (
        <div className={`ms-status ms-status-${status}`} role="status">
          <h3>
            {status === 'won'
              ? '本关完成'
              : status === 'lost'
                ? '停一步，再推敲'
                : status === 'learning'
                  ? '答案学习'
                  : '每一步，都有依据'}
          </h3>
          <p>
            {status === 'won'
              ? usedHint
                ? '已记录通关。重试可挑战无提示通关。'
                : '✦ 获得无提示通关记录。'
              : status === 'lost'
                ? '只标出踩中的雷。重试会恢复同一盘面。'
                : status === 'learning'
                  ? '已显示完整雷位与数字，本轮不计通关。重试后可以重新挑战。'
                  : '数字表示周围八格雷数。揭开全部安全格即可通关，插旗不是必需步骤。'}
          </p>
        </div>
      )}
      {!ended && hintTier > 0 && (
        <div className="ms-hint">
          <button className="ms-new-game" onClick={requestHint} disabled={hintTier === 3}>
            {hintTier === 0
              ? '提示：观察哪里'
              : hintTier === 1
                ? '继续：如何比较'
                : hintTier === 2
                  ? '继续：下一步及原因'
                  : '已展开全部提示'}
          </button>
          <p>从第一层起计为使用提示。</p>
          {hintTier > 0 && (
            <div role="status">
              <p>{hint?.observation ?? '检查已揭数字周围的标记，再重新尝试。'}</p>
              {hint && hintTier >= 2 && <p>{hint.reason}</p>}
              {hint && hintTier === 3 && (
                <p>
                  {hint.cells.map((i) => coordinate(i, level.cols)).join('、')}
                  {hint.mine ? ' 是雷，可以插旗。' : ' 安全，可以揭开；若已插旗，先取消标记。'}
                </p>
              )}
              <button onClick={clearHint}>收起提示</button>
            </div>
          )}
        </div>
      )}
      {ended && (
        <div className="ms-round-actions">
          {status === 'won' && onNext && (
            <button className="ms-new-game" onClick={onNext}>
              下一关 →
            </button>
          )}
          {status === 'lost' && (
            <button
              className="ms-new-game"
              onClick={() => {
                setStatus('learning')
                setUsedHint(true)
              }}
            >
              查看答案 · 不计通关
            </button>
          )}
        </div>
      )}
      {showHelp && (
        <div className="ms-help">
          <h4>规则与操作</h4>
          <p>{LESSONS[Math.floor((level.id - 1) / 5)]}</p>
          <p>固定盘面，未知格需推理后再揭开。数字表示周围八格的雷数；揭开全部安全格即可通关。</p>
          <p>
            方向键移动，Enter / 空格执行当前模式，F 或右键插旗。触屏可切换插旗模式。零格会自动展开。
          </p>
          <p>提示根据当前线索推理，旗帜只是笔记。查看本段规则不影响无提示记录。</p>
          <p>
            章内自由选关；通过任意四关或第五关结业题，解锁下一章。闯关进度独立记录，不混入经典模式的计分排行。
          </p>
        </div>
      )}
    </div>
  )
}
