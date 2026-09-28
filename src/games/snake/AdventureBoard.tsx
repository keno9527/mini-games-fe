import { useId } from 'react'
import { samePosition, type SnakeState } from './engine'
import type { SnakeLevel } from './levels'

const CELL = 32

export default function AdventureBoard({ level, state }: { level: SnakeLevel; state: SnakeState }) {
  const art = useId().replace(/:/g, '')
  const angle = { UP: -90, DOWN: 90, LEFT: 180, RIGHT: 0 }[state.direction]
  const head = state.snake[0]
  return (
    <svg
      className="snake-field snake-adventure-field"
      viewBox={`0 0 ${level.map[0].length * CELL} ${level.map.length * CELL}`}
      role="img"
      aria-label={`${level.name}棋盘，剩余 ${state.apples.length} 个苹果，蛇身 ${state.snake.length} 节，已走 ${state.moves} 步`}
    >
      <defs>
        <pattern id={`${art}-grid`} width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <path d={`M ${CELL} 0 H 0 V ${CELL}`} fill="none" stroke="#52725d" strokeOpacity=".15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${art}-grid)`} />
      {level.map.flatMap((row, y) =>
        [...row].map((tile, x) => {
          const cx = (x + 0.5) * CELL
          const cy = (y + 0.5) * CELL
          const key = `${x}:${y}`
          if (tile === '#')
            return (
              <rect
                key={key}
                x={x * CELL + 1}
                y={y * CELL + 1}
                width="30"
                height="30"
                rx="4"
                fill="#56715a"
                stroke="#405b47"
              />
            )
          if (tile === 'o' && state.apples.some((p) => samePosition(p, { x, y })))
            return (
              <g key={key} transform={`translate(${cx} ${cy})`}>
                <circle r="9" cy="2" fill="#ce6745" stroke="#a14e34" />
                <path d="M0 -6 Q0 -13 6 -13" stroke="#436741" strokeWidth="3" fill="none" />
                <circle cx="-3" cy="-1" r="2" fill="#f7c098" />
              </g>
            )
          if (['A', 'B', 'a', 'b'].includes(tile)) {
            const opened = state.keys.includes(tile.toLowerCase())
            if (tile === tile.toLowerCase() && opened) return null
            const isDoor = tile === tile.toUpperCase()
            return (
              <g key={key} transform={`translate(${cx} ${cy})`}>
                <rect
                  x="-13"
                  y="-13"
                  width="26"
                  height="26"
                  rx={isDoor ? 4 : 13}
                  fill={opened ? 'none' : tile.toLowerCase() === 'a' ? '#f1c46e' : '#a1c6e7'}
                  stroke={tile.toLowerCase() === 'a' ? '#9a722e' : '#47799c'}
                  strokeDasharray={opened ? '3 3' : undefined}
                />
                <text textAnchor="middle" y="6" fontSize="18" fontWeight="700" fill="#354b3d">
                  {opened ? '✓' : tile}
                </text>
              </g>
            )
          }
          if (tile === 'P' || tile === 'Q')
            return (
              <g key={key} transform={`translate(${cx} ${cy})`}>
                <circle r="13" fill="#e6d9f3" stroke="#82649b" strokeWidth="2" />
                <circle r="10" fill="none" stroke="#b197ca" strokeDasharray="3 2" />
                <text textAnchor="middle" y="5" fontSize="16" fontWeight="700" fill="#634779">
                  {tile}
                </text>
              </g>
            )
          if (tile === '*' && !state.gem)
            return (
              <path
                key={key}
                d={`M${cx} ${cy - 11} l10 11 -10 11 -10 -11 Z`}
                fill="#e8b744"
                stroke="#a87b27"
                strokeWidth="2"
              />
            )
          if (tile === 'E')
            return (
              <g key={key} transform={`translate(${cx} ${cy})`}>
                <rect
                  x="-13"
                  y="-13"
                  width="26"
                  height="26"
                  rx="5"
                  fill={state.apples.length ? '#b5c3a4' : '#faf3b4'}
                  stroke={state.apples.length ? '#7d906a' : '#8d761f'}
                  strokeWidth="2"
                />
                <text textAnchor="middle" y="6" fontSize="18" fontWeight="700" fill="#426048">
                  E
                </text>
              </g>
            )
          return null
        }),
      )}
      {state.snake.map((segment, index) => {
        const previous = state.snake[index - 1]
        // Never draw a line across the board when the body straddles a portal.
        const adjacent =
          previous && Math.abs(segment.x - previous.x) + Math.abs(segment.y - previous.y) === 1
        return (
          <g key={index}>
            {adjacent && (
              <line
                x1={(previous.x + 0.5) * CELL}
                y1={(previous.y + 0.5) * CELL}
                x2={(segment.x + 0.5) * CELL}
                y2={(segment.y + 0.5) * CELL}
                stroke="#478065"
                strokeWidth="22"
              />
            )}
            <rect
              x={segment.x * CELL + 4}
              y={segment.y * CELL + 4}
              width="24"
              height="24"
              rx="8"
              fill={index ? '#609573' : '#397452'}
              stroke="#376548"
            />
          </g>
        )
      })}
      <g
        transform={`translate(${(head.x + 0.5) * CELL} ${(head.y + 0.5) * CELL}) rotate(${angle})`}
      >
        {[-1, 1].map((side) => (
          <g key={side}>
            <circle cx="5" cy={side * 6} r="4" fill="#fff8dc" />
            <circle cx="6" cy={side * 6} r="2" fill="#243e2e" />
          </g>
        ))}
      </g>
    </svg>
  )
}
