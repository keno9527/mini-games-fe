import { GameToolbar } from '@/components/GameToolbar'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowUUpLeft,
  CaretDown,
  CheckCircle,
  Lightbulb,
} from '@phosphor-icons/react'
import { useGamePlay } from '@/hooks/useGamePlay'
import { useGameRecord } from '@/hooks/useGameRecord'
import { PUZZLE_LEVELS } from './levels'
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
import PuzzleBoard from './PuzzleBoard'
import LevelPicker from './LevelPicker'

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
  const [picking, setPicking] = useState(false)
  const [progress, setProgress] = useState(() => readProgress(gameId, userId))
  const [session, setSession] = useState(() => newSession(selected))
  const current = useRef(session)
  const [saveError, setSaveError] = useState('')
  const level = PUZZLE_LEVELS[selected - 1]
  const { state } = session
  const { start, submit } = useGameRecord({ gameId, userId })
  useGamePlay(
    gameId,
    state.moves > 0 && state.status === 'playing' ? (picking ? 'paused' : 'playing') : 'idle',
  )
  useEffect(() => {
    start()
  }, [start])
  useEffect(() => {
    saveSelection(gameId, userId, selected)
  }, [gameId, userId, selected])
  const completed = Object.keys(progress).length
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
          disabled={picking || state.status !== 'playing'}
          lastBlack={state.lastBlack}
          lastWhite={state.lastWhite}
          winning={winningLine(state.board, state.status === 'lost' ? 2 : 1)}
          hintPoints={hintPoints}
          onPlay={play}
        />
        <GameToolbar>
          <button
            data-game-control
            type="button"
            aria-label={`选择关卡，当前第 ${selected} 关，共 ${PUZZLE_LEVELS.length} 关`}
            aria-haspopup="dialog"
            aria-expanded={picking}
            onClick={(event) => {
              event.currentTarget.focus({ preventScroll: true })
              setPicking(true)
            }}
          >
            选关 {number(selected)} <CaretDown size={16} aria-hidden="true" />
          </button>
          <button data-game-control onClick={() => choose(selected)}>
            <ArrowCounterClockwise size={18} />
            重新开始
          </button>
          <button
            data-game-control
            onClick={undo}
            disabled={!session.history.length || state.status === 'won'}
          >
            <ArrowUUpLeft size={18} />
            悔棋
          </button>
          <button
            data-game-control
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
        </GameToolbar>
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
            <button data-game-control className="gp-next" onClick={() => choose(selected + 1)}>
              下一关 <ArrowRight size={17} />
            </button>
          )}
          {state.status === 'won' && selected === 30 && completed < 30 && (
            <button
              data-game-control
              className="gp-next"
              onClick={() => choose(PUZZLE_LEVELS.find((item) => !progress[item.id])!.id)}
            >
              继续未完成关卡 <ArrowRight size={17} />
            </button>
          )}
          {state.status === 'lost' && (
            <button data-game-control className="gp-next" onClick={() => choose(selected)}>
              重试本关
            </button>
          )}
        </div>
        {session.hint > 0 && state.status === 'playing' && (
          <div className="gp-hint game-panel" role="status">
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
      {picking && (
        <LevelPicker
          current={selected}
          progress={progress}
          onClose={() => setPicking(false)}
          onStart={(id) => {
            choose(id)
            setPicking(false)
          }}
        />
      )}
    </div>
  )
}
