import { useEffect, useMemo, useRef, useState } from 'react'
import { createRecord } from '@/api'
import {
  ANIMAL_META,
  applyMove,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createInitialState,
  getLegalMoves,
  getPiece,
  getTerrain,
  getTerrainOwner,
  type Position,
  type Side,
} from './engine.ts'
import '../game-surfaces.css'
import './animal-chess.css'

interface Props {
  userId?: string
  gameId: string
}

const SIDE_LABEL: Record<Side, string> = { red: '赤方', blue: '青方' }
const cells = Array.from({ length: BOARD_WIDTH * BOARD_HEIGHT }, (_, index) => ({
  x: index % BOARD_WIDTH,
  y: Math.floor(index / BOARD_WIDTH),
}))
const isSamePosition = (left: Position | null, right: Position) =>
  left?.x === right.x && left.y === right.y

function terrainLabel(position: Position) {
  const terrain = getTerrain(position)
  if (terrain === 'water') return '河流'
  if (terrain === 'trap') return `${SIDE_LABEL[getTerrainOwner(position)!]}陷阱`
  if (terrain === 'den') return `${SIDE_LABEL[getTerrainOwner(position)!]}兽穴`
  return '草地'
}

export default function AnimalChess({ userId, gameId }: Props) {
  const [game, setGame] = useState(createInitialState)
  const [selected, setSelected] = useState<Position | null>(null)
  const startedAtRef = useRef(Date.now())
  const submittedRef = useRef(false)
  const legalMoves = useMemo(
    () => (selected ? getLegalMoves(game, selected) : []),
    [game, selected],
  )

  useEffect(() => {
    if (!game.winner || !userId || submittedRef.current) return
    submittedRef.current = true
    const duration = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000))
    void createRecord(userId, {
      gameId,
      score: 100,
      duration,
      result: 'complete',
    }).catch(() => undefined)
  }, [game.winner, gameId, userId])

  const reset = () => {
    setGame(createInitialState())
    setSelected(null)
    startedAtRef.current = Date.now()
    submittedRef.current = false
  }

  const selectCell = (position: Position) => {
    if (game.winner) return
    const target = getPiece(game, position)
    if (isSamePosition(selected, position)) {
      setSelected(null)
      return
    }
    if (target?.side === game.turn) {
      setSelected(position)
      return
    }
    if (!selected || !legalMoves.some((move) => isSamePosition(move, position))) return
    setGame((current) => applyMove(current, selected, position))
    setSelected(null)
  }

  const redCount = game.pieces.filter(({ side }) => side === 'red').length
  const blueCount = game.pieces.length - redCount
  const selectedPiece = selected ? getPiece(game, selected) : undefined
  const status = game.winner
    ? `${SIDE_LABEL[game.winner]}获胜`
    : selectedPiece
      ? `${SIDE_LABEL[game.turn]}已选 ${ANIMAL_META[selectedPiece.animal].name}`
      : `轮到${SIDE_LABEL[game.turn]}`

  return (
    <section className="game-surface animal-chess-room" aria-label="斗兽棋">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">JUNGLE · LOCAL DUEL</p>
          <h2>斗兽棋</h2>
        </div>
        <span className="animal-paw" aria-hidden="true">
          🐾
        </span>
      </header>

      <div className="gs-play-layout animal-play-layout">
        <div className="animal-board-column">
          <div className={`animal-turn animal-turn-${game.winner ?? game.turn}`} aria-live="polite">
            <span>{status}</span>
            <small>{game.winner ? '对局结束' : '点击己方棋子查看可走位置'}</small>
          </div>

          <div className="animal-board-shell">
            <div className="animal-board" role="grid" aria-label="七列九行斗兽棋棋盘">
              {cells.map((position) => {
                const piece = getPiece(game, position)
                const terrain = getTerrain(position)
                const legal = legalMoves.some((move) => isSamePosition(move, position))
                const selectedCell = isSamePosition(selected, position)
                const lastMove =
                  isSamePosition(game.lastMove?.from ?? null, position) ||
                  isSamePosition(game.lastMove?.to ?? null, position)
                const label = piece
                  ? `${terrainLabel(position)}，${SIDE_LABEL[piece.side]}${ANIMAL_META[piece.animal].name}`
                  : terrainLabel(position)
                return (
                  <button
                    className={`animal-cell terrain-${terrain}${selectedCell ? ' is-selected' : ''}${legal ? ' is-legal' : ''}${lastMove ? ' is-last' : ''}`}
                    type="button"
                    role="gridcell"
                    aria-label={label}
                    aria-pressed={selectedCell}
                    disabled={Boolean(game.winner)}
                    tabIndex={piece?.side === game.turn || legal ? 0 : -1}
                    key={`${position.x}-${position.y}`}
                    onClick={() => selectCell(position)}
                  >
                    {terrain === 'water' && <span className="animal-water-mark">≈</span>}
                    {terrain === 'trap' && <span className="animal-terrain-mark">陷</span>}
                    {terrain === 'den' && <span className="animal-terrain-mark">穴</span>}
                    {legal && <span className="animal-legal-mark" aria-hidden="true" />}
                    {piece && (
                      <span className={`animal-piece animal-piece-${piece.side}`}>
                        <strong>{ANIMAL_META[piece.animal].symbol}</strong>
                        <small>{ANIMAL_META[piece.animal].rank}</small>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="gs-sidebar">
          <div className="gs-panel animal-scorecard">
            <p className="gs-eyebrow">FIELD REPORT</p>
            <h3>{status}</h3>
            <div className="animal-armies">
              <span>
                <i className="red" />
                赤方 <strong>{redCount}</strong>
              </span>
              <span>
                <i className="blue" />
                青方 <strong>{blueCount}</strong>
              </span>
            </div>
            <div className="gs-stat">
              <span>已行棋</span>
              <strong>
                {game.moves}
                <small> 步</small>
              </strong>
            </div>
          </div>

          <button className="gs-primary" type="button" onClick={reset}>
            重新开局
          </button>

          <div className="gs-help animal-rules">
            <strong>强弱顺序</strong>
            <p>象 › 狮 › 虎 › 豹 › 狼 › 狗 › 猫 › 鼠；鼠可吃象，象不能吃鼠。</p>
            <strong>地形规则</strong>
            <p>只有鼠能下河。狮、虎可越过无鼠阻挡的河道。进入敌方兽穴即可获胜。</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
