import { useGamePlay } from '@/hooks/useGamePlay'
import { useEffect, useMemo, useState } from 'react'
import type { GameComponentProps } from '@/games/manifest'
import { useGameRecord } from '@/hooks/useGameRecord'
import {
  ANIMAL_META,
  applyMove,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  chooseComputerMove,
  createInitialState,
  getLegalMoves,
  getMoveError,
  getOutcome,
  getPiece,
  type Position,
} from './engine.ts'
import '../game-surfaces.css'
import '../animal-chess/animal-chess.css'
import './animal-chess-ai.css'

const cells = Array.from({ length: BOARD_WIDTH * BOARD_HEIGHT }, (_, index) => ({
  x: index % BOARD_WIDTH,
  y: Math.floor(index / BOARD_WIDTH),
}))
const samePosition = (a: Position | null, b: Position) => a?.x === b.x && a.y === b.y

function AnimalChessSession({ userId, gameId }: GameComponentProps) {
  const [game, setGame] = useState(createInitialState)
  const play = useGamePlay(gameId)
  const [selected, setSelected] = useState<Position | null>(null)
  const [message, setMessage] = useState('你执赤方先行。点击己方棋子，再点击高亮位置。')
  const { start, submit } = useGameRecord({ userId, gameId })
  const legalMoves = useMemo(
    () => (selected ? getLegalMoves(game, selected) : []),
    [game, selected],
  )
  const thinking = game.turn === 'blue' && !game.winner

  useEffect(() => {
    start()
  }, [start])

  useEffect(() => {
    if (game.winner) {
      play.stop()
      void submit(getOutcome(game.winner))
    }
  }, [game.winner, submit, play])

  useEffect(() => {
    if (!thinking) return
    const timer = window.setTimeout(() => {
      const move = chooseComputerMove(game)
      if (move) {
        // A callback from a previous game must never move in a restarted game.
        setGame((current) => (current === game ? applyMove(current, move.from, move.to) : current))
      }
    }, 550)
    return () => window.clearTimeout(timer)
  }, [game, thinking])

  const reset = () => {
    play.restart()
    start()
    setGame(createInitialState())
    setSelected(null)
    setMessage('新的一局，你执赤方先行。')
  }

  const selectCell = (position: Position) => {
    if (game.winner || thinking) return
    const target = getPiece(game, position)
    if (samePosition(selected, position)) {
      setSelected(null)
      setMessage('已取消选择。点击一枚赤方棋子继续。')
      return
    }
    if (target?.side === 'red') {
      setSelected(position)
      setMessage(
        getLegalMoves(game, position).length
          ? `已选${ANIMAL_META[target.animal].name}，点击高亮位置移动或吃子。`
          : '这枚棋子暂时无路可走，请选择其他棋子。',
      )
      return
    }
    if (!selected) {
      setMessage('请先选择一枚赤方棋子。')
      return
    }
    const error = getMoveError(game, selected, position)
    if (error) {
      setMessage(error)
      return
    }
    play.start()
    setGame((current) => (current === game ? applyMove(current, selected, position) : current))
    setSelected(null)
    setMessage('点击一枚赤方棋子继续行棋。')
  }

  const redCount = game.pieces.filter(({ side }) => side === 'red').length
  const blueCount = game.pieces.length - redCount
  const status =
    game.winner === 'red'
      ? '你获胜了！'
      : game.winner === 'blue'
        ? '电脑获胜'
        : thinking
          ? '电脑正在思考…'
          : '轮到你了'
  const lastPiece = game.lastMove ? getPiece(game, game.lastMove.to) : undefined
  const lastAction =
    game.lastMove && lastPiece
      ? `${lastPiece.side === 'red' ? '你' : '电脑'}的${ANIMAL_META[lastPiece.animal].name}：${game.lastMove.from.x + 1}列${game.lastMove.from.y + 1}行 → ${game.lastMove.to.x + 1}列${game.lastMove.to.y + 1}行`
      : '尚未行棋'

  return (
    <section className="game-surface animal-chess-room animal-ai-room" aria-label="斗兽棋人机版">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">JUNGLE · SOLO DUEL</p>
          <h2>斗兽棋 · 人机版</h2>
        </div>
        <span className="animal-paw" aria-hidden="true">
          🐾
        </span>
      </header>

      <div className="gs-play-layout animal-play-layout">
        <div className="animal-board-column">
          <div className={`animal-turn animal-turn-${game.winner ?? game.turn}`} role="status">
            <span>{status}</span>
            <small>你是赤方 · 电脑是青方</small>
          </div>
          <div className="animal-board-shell">
            <div
              className="animal-board"
              role="group"
              aria-label="七列九行斗兽棋棋盘"
              aria-busy={thinking}
            >
              {cells.map((position) => {
                const piece = getPiece(game, position)
                const legal = legalMoves.some((move) => samePosition(move, position))
                const selectedCell = samePosition(selected, position)
                const lastMove =
                  samePosition(game.lastMove?.from ?? null, position) ||
                  samePosition(game.lastMove?.to ?? null, position)
                const label = `${position.x + 1}列${position.y + 1}行，${piece ? `${piece.side === 'red' ? '赤方' : '青方'}${ANIMAL_META[piece.animal].name}` : '空格'}${legal ? '，可走' : ''}`
                return (
                  <button
                    className={`animal-cell${selectedCell ? ' is-selected' : ''}${legal ? ' is-legal' : ''}${lastMove ? ' is-last' : ''}`}
                    type="button"
                    aria-label={label}
                    aria-pressed={selectedCell}
                    disabled={Boolean(game.winner) || thinking}
                    tabIndex={piece?.side === 'red' || legal ? 0 : -1}
                    key={`${position.x}-${position.y}`}
                    onClick={() => selectCell(position)}
                  >
                    {legal && <span className="animal-legal-mark" aria-hidden="true" />}
                    {piece && (
                      <span
                        className={`animal-piece animal-piece-${piece.side}`}
                        aria-hidden="true"
                      >
                        <strong>{ANIMAL_META[piece.animal].symbol}</strong>
                        <small>{ANIMAL_META[piece.animal].rank}</small>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="animal-ai-message" role="status">
            {game.winner
              ? '对局结束，点击“重新开局”再来一局。'
              : thinking
                ? '电脑行动中，请稍候。'
                : message}
          </p>
          {game.skippedSide && (
            <p className="animal-ai-notice" role="status">
              {game.skippedSide === 'red' ? '你' : '电脑'}暂时没有合法走法，本回合自动跳过。
            </p>
          )}
        </div>

        <aside className="gs-sidebar">
          <div className="gs-panel animal-scorecard">
            <p className="gs-eyebrow">对局概况</p>
            <h3>{game.winner ? status : '吃光对手，即可获胜'}</h3>
            <div className="animal-armies">
              <span>
                <i className="red" />你 · 赤方<strong>{redCount}</strong>
              </span>
              <span>
                <i className="blue" />
                电脑 · 青方<strong>{blueCount}</strong>
              </span>
            </div>
            <div className="gs-stat">
              <span>已行棋</span>
              <strong>
                {game.moves}
                <small> 步</small>
              </strong>
            </div>
            <p className="animal-ai-last-action">{lastAction}</p>
          </div>
          <button className="gs-primary" type="button" onClick={reset}>
            重新开局
          </button>
          <div className="gs-help animal-rules">
            <strong>同级可吃，先手占先</strong>
            <p>象 › 狮 › 虎 › 豹 › 狼 › 狗 › 猫 › 鼠。可吃同级或更弱棋子；鼠能吃象，象不能吃鼠。</p>
            <strong>每次一格，全盘可走</strong>
            <p>向上下左右移动一格，所有格子规则相同。没有河流、陷阱、兽穴或跳跃规则。</p>
            <strong>轻松对弈</strong>
            <p>电脑优先吃子，否则随机移动。无路可走时自动跳过回合；也可随时重新开局。</p>
            <p>
              {userId
                ? '胜利 100 分，失败 0 分。结束后记录胜负和时长，重开不计战绩。'
                : '当前为游客，可自由对弈。选择玩家后，新对局会记录战绩。'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default function AnimalChessAI(props: GameComponentProps) {
  // Switching players starts a fresh session so a game cannot be credited to someone else.
  return <AnimalChessSession key={`${props.gameId}:${props.userId ?? 'guest'}`} {...props} />
}
