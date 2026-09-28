import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowUUpLeft,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Lightbulb,
} from '@phosphor-icons/react'
import { useGamePlay } from '@/hooks/useGamePlay'
import { useGameRecord } from '@/hooks/useGameRecord'
import { CHAPTERS, PUZZLE_LEVELS } from './levels'
import {
  coordinate,
  initialState,
  playRound,
  solutionLine,
  solvePuzzle,
  winningLine,
  type PuzzleState,
} from './puzzle-engine'
import {
  completePuzzle,
  readProgress,
  readSelection,
  saveProgress,
  saveSelection,
} from './progression'
import PuzzleBoard, { MiniBoard } from './PuzzleBoard'

const number = (value: number) => String(value).padStart(2, '0')
interface Props {
  gameId: string
  userId?: string
}
interface Session {
  state: PuzzleState
  history: PuzzleState[]
  hint: number
  assisted: boolean
}
const newSession = (id: number): Session => ({
  state: initialState(PUZZLE_LEVELS[id - 1].board),
  history: [],
  hint: 0,
  assisted: false,
})

export default function PuzzleCampaign({ gameId, userId }: Props) {
  const [selected, setSelected] = useState(() => readSelection(gameId, userId))
  const [chapter, setChapter] = useState(() => Math.floor((selected - 1) / 6))
  const [progress, setProgress] = useState(() => readProgress(gameId, userId))
  const [session, setSession] = useState(() => newSession(selected))
  const current = useRef(session)
  const [saveError, setSaveError] = useState('')
  const level = PUZZLE_LEVELS[selected - 1]
  const { state } = session
  const { start, submit } = useGameRecord({ gameId, userId })
  useGamePlay(gameId, state.moves > 0 && state.status === 'playing' ? 'playing' : 'idle')
  useEffect(() => {
    start()
  }, [start])
  useEffect(() => {
    saveSelection(gameId, userId, selected)
  }, [gameId, userId, selected])
  const completed = Object.keys(progress).length
  const chapterLevels = PUZZLE_LEVELS.slice(chapter * 6, chapter * 6 + 6)
  const chapterCompleted = chapterLevels.filter((item) => progress[item.id]).length
  const answers = useMemo(
    () =>
      session.hint && state.status === 'playing'
        ? solvePuzzle(state.board, level.moves - state.moves)
        : [],
    [session.hint, state, level.moves],
  )
  const hintPoints =
    session.hint >= 3
      ? answers
      : session.hint === 2
        ? state.board.flatMap((stone, point) =>
            !stone &&
            answers.some(
              (answer) =>
                Math.abs((point % 15) - (answer % 15)) <= 1 &&
                Math.abs(Math.floor(point / 15) - Math.floor(answer / 15)) <= 1,
            )
              ? [point]
              : [],
          )
        : []
  function update(next: Session) {
    current.current = next
    setSession(next)
  }
  function choose(id: number) {
    setSelected(id)
    setChapter(Math.floor((id - 1) / 6))
    update(newSession(id))
    start()
  }
  function play(point: number) {
    const previous = current.current
    const next = playRound(previous.state, point, level.moves)
    if (next === previous.state) return
    update({ ...previous, state: next, history: [...previous.history, previous.state], hint: 0 })
    if (next.status === 'won') {
      const results = completePuzzle(readProgress(gameId, userId), selected, !previous.assisted)
      setProgress(results)
      try {
        saveProgress(gameId, userId, results)
        setSaveError('')
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : '进度保存失败')
      }
      void submit({ level: selected, result: 'win', score: previous.assisted ? 60 : 100 })
    }
  }
  function undo() {
    const previous = current.current
    const state = previous.history.at(-1)
    if (!state || previous.state.status === 'won') return
    update({ state, history: previous.history.slice(0, -1), hint: 0, assisted: true })
  }
  return (
    <div className="gp-layout">
      <section className="gp-play" aria-label="当前残局">
        <div className="gp-titlebar">
          <div>
            <span className="gp-level-number">{number(selected)} / 30</span>
            <h2>{level.name}</h2>
          </div>
          <span className="gp-goal">{level.moves} 手内获胜</span>
        </div>
        <div className="gp-board-caption">
          <span>
            <i className="gp-black-dot" /> 执黑先行
          </span>
          <span>
            {level.moves >= 3 ? '连续冲四' : level.moves === 2 ? '制造双重威胁' : '找到成五点'} ·
            剩余 {Math.max(0, level.moves - state.moves)} 手
          </span>
        </div>
        <PuzzleBoard
          key={selected}
          board={state.board}
          disabled={state.status !== 'playing'}
          lastBlack={state.lastBlack}
          lastWhite={state.lastWhite}
          winning={winningLine(state.board, state.status === 'lost' ? 2 : 1)}
          hintPoints={hintPoints}
          onPlay={play}
        />
        <div className="gp-controls">
          <button onClick={() => choose(selected)}>
            <ArrowCounterClockwise size={18} />
            重来
          </button>
          <button onClick={undo} disabled={!session.history.length || state.status === 'won'}>
            <ArrowUUpLeft size={18} />
            悔棋
          </button>
          <button
            onClick={() =>
              update({
                ...current.current,
                hint: Math.min(3, current.current.hint + 1),
                assisted: true,
              })
            }
            disabled={state.status !== 'playing' || session.hint >= 3}
          >
            <Lightbulb size={18} />
            提示{session.hint ? ` ${session.hint}/3` : ''}
          </button>
          <span className="gp-input-note">点击落子 · 拖动预览</span>
        </div>
        <div
          className={`gp-feedback gp-feedback--${state.status}`}
          role="status"
          aria-live="polite"
        >
          <div>
            <strong>
              {state.status === 'won' ? (
                <>
                  <CheckCircle size={19} weight="fill" />{' '}
                  {completed === 30
                    ? '30 关全部通关！'
                    : session.assisted
                      ? '挑战完成'
                      : '独立完成！'}
                </>
              ) : state.status === 'lost' ? (
                '再想一步'
              ) : (
                state.message
              )}
            </strong>
            {state.status === 'won' ? (
              <p>{level.explanation}</p>
            ) : state.status === 'lost' ? (
              <p>{state.message}</p>
            ) : null}
          </div>
          {state.status === 'won' && selected < 30 && (
            <button className="gp-next" onClick={() => choose(selected + 1)}>
              下一关 <ArrowRight size={17} />
            </button>
          )}
          {state.status === 'won' && selected === 30 && completed < 30 && (
            <button
              className="gp-next"
              onClick={() => choose(PUZZLE_LEVELS.find((item) => !progress[item.id])!.id)}
            >
              继续未完成关卡 <ArrowRight size={17} />
            </button>
          )}
          {state.status === 'lost' && (
            <button className="gp-next" onClick={() => choose(selected)}>
              重试本关
            </button>
          )}
        </div>
        {session.hint > 0 && state.status === 'playing' && (
          <div className="gp-hint" role="status">
            <Lightbulb size={18} />
            <div>
              <strong>
                {
                  [
                    '',
                    '战术提示',
                    '关键区域已标出',
                    `可落子：${answers.map(coordinate).join('、')}`,
                  ][session.hint]
                }
              </strong>
              <p>
                {session.hint === 3
                  ? `参考变化：${solutionLine(state.board, level.moves - state.moves)}。白棋改堵另一处时，选择剩余成五点。`
                  : session.hint === 2
                    ? '观察棋盘标出的区域，寻找能同时连接多颗棋子的交点。'
                    : state.moves === 0
                      ? level.hint
                      : '沿刚才的落子寻找新的冲四方向；保持每步都有下一手成五的威胁。'}
              </p>
            </div>
          </div>
        )}
        {state.status === 'won' && (
          <details className="gp-analysis">
            <summary>查看参考解法</summary>
            <p>{solutionLine(level.board, level.moves)}</p>
            <p>所有符合本关目标的解法都接受，不必照搬参考顺序。</p>
          </details>
        )}
        {saveError && (
          <p className="gp-save-error" role="alert">
            {saveError}；当前通关结果仍保留在页面中。
          </p>
        )}
      </section>
      <aside className="gp-picker" aria-label="残局关卡">
        <header className="gp-picker-heading">
          <h3>残局关卡</h3>
          <span>
            <b>{completed}</b> / 30 通关
          </span>
        </header>
        <progress value={completed} max={30} aria-label="总通关进度" />
        <nav className="gp-chapters" aria-label="选择章节">
          {CHAPTERS.map((item, index) => (
            <button
              key={item.name}
              aria-label={`第 ${index + 1} 章 ${item.name}`}
              aria-pressed={chapter === index}
              onClick={() => setChapter(index)}
            >
              <span>{number(index + 1)}</span>
              <small>{item.name.slice(0, 2)}</small>
            </button>
          ))}
        </nav>
        <div className="gp-chapter-heading">
          <h4>{CHAPTERS[chapter].name}</h4>
          <span>{chapterCompleted} / 6</span>
        </div>
        <div className="gp-levels">
          {chapterLevels.map((item) => (
            <button
              key={item.id}
              className={`gp-level${selected === item.id ? ' is-current' : ''}`}
              aria-current={selected === item.id ? 'step' : undefined}
              aria-label={`${number(item.id)} ${item.name}，${item.moves} 手内获胜，${progress[item.id] === 2 ? '独立完成' : progress[item.id] ? '已通关' : '未完成'}`}
              onClick={() => choose(item.id)}
            >
              <MiniBoard board={item.board} />
              <span className="gp-level-copy">
                <strong>
                  <span>{number(item.id)}</span> {item.name}
                </strong>
                <small>{item.moves} 手内获胜</small>
              </span>
              <span
                className={`gp-level-status${progress[item.id] ? ' is-complete' : ''}`}
                title={
                  progress[item.id] === 2 ? '独立完成' : progress[item.id] ? '已通关' : undefined
                }
              >
                {progress[item.id] ? (
                  <>
                    <Check weight="bold" size={16} />
                    <small>{progress[item.id] === 2 ? '独立' : '完成'}</small>
                  </>
                ) : selected === item.id ? (
                  '当前'
                ) : (
                  '待解'
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="gp-chapter-footer">
          <button
            aria-label="上一章"
            disabled={chapter === 0}
            onClick={() => setChapter(chapter - 1)}
          >
            <CaretLeft />
          </button>
          <span>第 {chapter + 1} 章 / 共 5 章</span>
          <button
            aria-label="下一章"
            disabled={chapter === 4}
            onClick={() => setChapter(chapter + 1)}
          >
            <CaretRight />
          </button>
        </div>
        <p className="gp-lesson">{CHAPTERS[chapter].lesson}</p>
        <details className="gp-rules">
          <summary>
            玩法说明 <span>＋</span>
          </summary>
          <p>15×15 自由五子棋，五连及以上获胜，没有禁手。黑棋先行，手数只统计黑棋。</p>
          <p>
            每次非终结落子都需形成“下一手能成五”的冲四威胁；白棋会优先获胜，否则封堵。连续进攻，在限定手数内取胜。
          </p>
          <p>
            提示依次提供战术、区域和参考解法。使用提示或悔棋仍可通关；本次未使用两者则记为独立完成。
          </p>
          <p>
            30 关均可自由选择。方向键移动焦点，回车落子；触屏可拖动预览，抬手落子，移出棋盘取消。
          </p>
        </details>
      </aside>
    </div>
  )
}
