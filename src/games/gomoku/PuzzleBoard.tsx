import { useRef, useState, type PointerEvent } from 'react'
import { coordinate, SIZE, type Board } from './puzzle-engine'

const EDGE = 24
const STEP = 28
const WIDTH = EDGE * 2 + STEP * (SIZE - 1)
const gridPath = Array.from({ length: SIZE }, (_, i) => {
  const v = EDGE + i * STEP
  return `M ${v} ${EDGE} V ${WIDTH - EDGE} M ${EDGE} ${v} H ${WIDTH - EDGE}`
}).join(' ')

export function MiniBoard({ board }: { board: Board }) {
  return (
    <svg className="gp-mini" viewBox={`0 0 ${WIDTH} ${WIDTH}`} aria-hidden="true">
      <rect width={WIDTH} height={WIDTH} rx="20" fill="#e4c58e" />
      <path d={gridPath} stroke="#9a784c" strokeWidth="3" fill="none" />
      {board.map((stone, point) =>
        stone ? (
          <circle
            key={point}
            cx={EDGE + (point % SIZE) * STEP}
            cy={EDGE + Math.floor(point / SIZE) * STEP}
            r="12"
            fill={stone === 1 ? '#262b28' : '#fffaf0'}
            stroke={stone === 1 ? '#131915' : '#ad9978'}
            strokeWidth="2"
          />
        ) : null,
      )}
    </svg>
  )
}

interface Props {
  board: Board
  disabled: boolean
  lastBlack: number | null
  lastWhite: number | null
  winning: readonly number[]
  hintPoints: readonly number[]
  onPlay: (point: number) => void
}

export default function PuzzleBoard({
  board,
  disabled,
  lastBlack,
  lastWhite,
  winning,
  hintPoints,
  onPlay,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const activePointer = useRef<number | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [focus, setFocus] = useState(112)
  function locate(event: PointerEvent<HTMLDivElement>): number | null {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH
    const y = ((event.clientY - bounds.top) / bounds.height) * WIDTH
    if (
      x < EDGE - STEP / 2 ||
      x > WIDTH - EDGE + STEP / 2 ||
      y < EDGE - STEP / 2 ||
      y > WIDTH - EDGE + STEP / 2
    )
      return null
    const point = Math.round((y - EDGE) / STEP) * SIZE + Math.round((x - EDGE) / STEP)
    return !disabled && board[point] === 0 ? point : null
  }
  return (
    <div className="gp-board-frame">
      <div
        ref={root}
        className="gomoku-board gp-board"
        role="group"
        aria-label="残局棋盘，15 行 15 列，方向键移动，回车落子"
        onPointerDown={(event) => {
          if (disabled || event.button !== 0 || activePointer.current !== null) return
          event.preventDefault()
          activePointer.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          setPreview(locate(event))
        }}
        onPointerMove={(event) => {
          if (activePointer.current === event.pointerId) setPreview(locate(event))
        }}
        onPointerUp={(event) => {
          if (activePointer.current !== event.pointerId) return
          const point = locate(event)
          activePointer.current = null
          setPreview(null)
          event.currentTarget.releasePointerCapture(event.pointerId)
          if (point !== null) {
            setFocus(point)
            onPlay(point)
          }
        }}
        onPointerCancel={() => {
          activePointer.current = null
          setPreview(null)
        }}
        onLostPointerCapture={() => {
          activePointer.current = null
          setPreview(null)
        }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${WIDTH}`} className="gomoku-lines" aria-hidden="true">
          <path d={gridPath} fill="none" />
          {[48, 56, 112, 168, 176].map((point) => (
            <circle
              key={point}
              cx={EDGE + (point % SIZE) * STEP}
              cy={EDGE + Math.floor(point / SIZE) * STEP}
              r="2.5"
            />
          ))}
          {Array.from({ length: SIZE }, (_, i) => (
            <g key={i}>
              <text x={EDGE + i * STEP} y="12">
                {String.fromCharCode(65 + i)}
              </text>
              <text x="10" y={EDGE + i * STEP + 3}>
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
        {board.map((stone, point) => (
          <button
            key={point}
            type="button"
            data-point={point}
            className={`gomoku-point${winning.includes(point) ? ' gp-winning' : ''}${hintPoints.includes(point) ? ' gp-hint-point' : ''}`}
            tabIndex={focus === point ? 0 : -1}
            aria-label={`${coordinate(point)}，${stone === 1 ? '黑棋' : stone === 2 ? '白棋' : '空位'}`}
            aria-disabled={disabled || stone !== 0}
            onFocus={() => setFocus(point)}
            onClick={(event) => {
              if (event.detail === 0 && !disabled && !stone) onPlay(point)
            }}
            onKeyDown={(event) => {
              const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE }[
                event.key
              ]
              if (delta === undefined) return
              event.preventDefault()
              const next = point + delta
              if (
                next < 0 ||
                next >= SIZE * SIZE ||
                (Math.abs(delta) === 1 && Math.floor(next / SIZE) !== Math.floor(point / SIZE))
              )
                return
              setFocus(next)
              root.current?.querySelector<HTMLButtonElement>(`[data-point="${next}"]`)?.focus()
            }}
            style={{
              left: `${((EDGE + (point % SIZE) * STEP - STEP / 2) / WIDTH) * 100}%`,
              top: `${((EDGE + Math.floor(point / SIZE) * STEP - STEP / 2) / WIDTH) * 100}%`,
              width: `${(STEP / WIDTH) * 100}%`,
              height: `${(STEP / WIDTH) * 100}%`,
            }}
          >
            {stone ? (
              <span className={`gomoku-stone ${stone === 1 ? 'black' : 'white'}`}>
                {(point === lastBlack || point === lastWhite) && <i className="gomoku-last" />}
              </span>
            ) : preview === point ? (
              <span className="gomoku-stone black gp-preview" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}
