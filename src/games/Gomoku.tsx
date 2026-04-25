import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Cell = 'X' | 'O' | null
type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'playing' | 'over'

const SIZE = 15
const STAR = [3, 7, 11]

const inBounds = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE

function isWin(board: Cell[][], x: number, y: number, s: 'X' | 'O'): boolean {
  const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (const [dx, dy] of dirs) {
    let c = 1
    for (let k = 1; k < 5; k++) {
      const nx = x + dx * k, ny = y + dy * k
      if (!inBounds(nx, ny) || board[ny][nx] !== s) break
      c++
    }
    for (let k = 1; k < 5; k++) {
      const nx = x - dx * k, ny = y - dy * k
      if (!inBounds(nx, ny) || board[ny][nx] !== s) break
      c++
    }
    if (c >= 5) return true
  }
  return false
}

function scorePattern(count: number, openA: boolean, openB: boolean): number {
  const open = (openA ? 1 : 0) + (openB ? 1 : 0)
  if (count >= 5) return 1e7
  if (count === 4) {
    if (open === 2) return 1e5
    if (open === 1) return 1e4
    return 0
  }
  if (count === 3) {
    if (open === 2) return 1e3
    if (open === 1) return 100
    return 0
  }
  if (count === 2) {
    if (open === 2) return 50
    if (open === 1) return 10
    return 0
  }
  if (count === 1) return open === 2 ? 5 : 1
  return 0
}

function cellScore(board: Cell[][], x: number, y: number, s: 'X' | 'O'): number {
  const dirs: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]]
  let total = 0
  for (const [dx, dy] of dirs) {
    let count = 1
    let k = 1
    while (inBounds(x + dx * k, y + dy * k) && board[y + dy * k][x + dx * k] === s) {
      count++
      k++
    }
    const openA = inBounds(x + dx * k, y + dy * k) && board[y + dy * k][x + dx * k] === null
    k = 1
    while (inBounds(x - dx * k, y - dy * k) && board[y - dy * k][x - dx * k] === s) {
      count++
      k++
    }
    const openB = inBounds(x - dx * k, y - dy * k) && board[y - dy * k][x - dx * k] === null
    total += scorePattern(count, openA, openB)
  }
  return total
}

function hasNeighbor(board: Cell[][], x: number, y: number, range: number): boolean {
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx, ny = y + dy
      if (inBounds(nx, ny) && board[ny][nx] !== null) return true
    }
  }
  return false
}

function candidateCells(board: Cell[][]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] === null && hasNeighbor(board, x, y, 2)) out.push({ x, y })
    }
  }
  return out
}

function aiMove(board: Cell[][], level: Level): { x: number; y: number } | null {
  const cells = candidateCells(board)
  if (cells.length === 0) return { x: 7, y: 7 }

  // 必胜检查
  for (const { x, y } of cells) {
    board[y][x] = 'O'
    const win = isWin(board, x, y, 'O')
    board[y][x] = null
    if (win) return { x, y }
  }

  // 必堵检查
  for (const { x, y } of cells) {
    board[y][x] = 'X'
    const win = isWin(board, x, y, 'X')
    board[y][x] = null
    if (win) return { x, y }
  }

  if (level === '简单') {
    return cells[Math.floor(Math.random() * cells.length)]
  }

  // 评分：中等 = 攻+0.8防；复杂 = 1.1攻+防
  const attackW = level === '复杂' ? 1.1 : 1.0
  const defenseW = level === '复杂' ? 1.0 : 0.8

  let best = cells[0]
  let bestScore = -Infinity
  for (const c of cells) {
    const a = cellScore(board, c.x, c.y, 'O')
    const d = cellScore(board, c.x, c.y, 'X')
    const s = a * attackW + d * defenseW + Math.random() * 0.1
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return best
}

function emptyBoard(): Cell[][] {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
}

const STONE = 28
const MARGIN = 22
const BOARD_PX = MARGIN * 2 + (SIZE - 1) * STONE

export default function Gomoku({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [board, setBoard] = useState<Cell[][]>(emptyBoard)
  const [status, setStatus] = useState<Status>('idle')
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [message, setMessage] = useState('你执黑先手，点「开始对局」')
  const [lastMove, setLastMove] = useState<{ x: number; y: number } | null>(null)

  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)

  const submitEnd = useCallback(
    async (result: 'win' | 'lose' | 'complete', score: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const dur = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
      try {
        await createRecord(userId, { gameId, score, duration: dur, result })
      } catch {}
    },
    [userId, gameId]
  )

  const endGame = useCallback(
    (outcome: 'X' | 'O' | 'draw') => {
      setStatus('over')
      if (outcome === 'X') {
        setMessage('你赢了！🎉')
        void submitEnd('win', 100)
      } else if (outcome === 'O') {
        setMessage('电脑赢了…')
        void submitEnd('lose', 10)
      } else {
        setMessage('平局')
        void submitEnd('complete', 40)
      }
    },
    [submitEnd]
  )

  const reset = useCallback(() => {
    setBoard(emptyBoard())
    setStatus('idle')
    setTurn('X')
    setMessage('你执黑先手，点「开始对局」')
    setLastMove(null)
    submittedRef.current = false
  }, [])

  useEffect(() => {
    reset()
  }, [level, reset])

  const start = () => {
    setBoard(emptyBoard())
    setStatus('playing')
    setTurn('X')
    setMessage('轮到你（黑）')
    setLastMove(null)
    submittedRef.current = false
    startTimeRef.current = Date.now()
  }

  const playAI = useCallback(
    (b: Cell[][]) => {
      const working = b.map(r => [...r])
      const mv = aiMove(working, level)
      if (!mv) {
        endGame('draw')
        return
      }
      working[mv.y][mv.x] = 'O'
      setBoard(working)
      setLastMove(mv)
      if (isWin(working, mv.x, mv.y, 'O')) {
        endGame('O')
        return
      }
      if (working.every(row => row.every(c => c !== null))) {
        endGame('draw')
        return
      }
      setTurn('X')
      setMessage('轮到你（黑）')
    },
    [level, endGame]
  )

  const onCell = (x: number, y: number) => {
    if (status !== 'playing' || turn !== 'X') return
    if (board[y][x] !== null) return
    const nb = board.map(r => [...r])
    nb[y][x] = 'X'
    setBoard(nb)
    setLastMove({ x, y })
    if (isWin(nb, x, y, 'X')) {
      endGame('X')
      return
    }
    if (nb.every(row => row.every(c => c !== null))) {
      endGame('draw')
      return
    }
    setTurn('O')
    setMessage('电脑思考中…')
    window.setTimeout(() => playAI(nb), 260)
  }

  const picking = status === 'idle' || status === 'over'

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {(['简单', '中等', '复杂'] as const).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!picking}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-purple text-white border-fun-purple'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-purple/50'
            } ${!picking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}
            {lv === '简单' && ' · 随机'}
            {lv === '中等' && ' · 会守'}
            {lv === '复杂' && ' · 棋形评估'}
          </button>
        ))}
      </div>

      <p className="text-sm font-bold text-fun-text min-h-[1.5rem]">{message}</p>

      <div
        className="relative rounded-2xl shadow-card border-4 border-[#8b5a2b]"
        style={{ width: BOARD_PX, height: BOARD_PX, background: '#f4d58d' }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={BOARD_PX} height={BOARD_PX}>
          {Array.from({ length: SIZE }, (_, i) => (
            <g key={i}>
              <line
                x1={MARGIN}
                y1={MARGIN + i * STONE}
                x2={MARGIN + (SIZE - 1) * STONE}
                y2={MARGIN + i * STONE}
                stroke="#6b3a1f"
                strokeWidth={1}
              />
              <line
                x1={MARGIN + i * STONE}
                y1={MARGIN}
                x2={MARGIN + i * STONE}
                y2={MARGIN + (SIZE - 1) * STONE}
                stroke="#6b3a1f"
                strokeWidth={1}
              />
            </g>
          ))}
          {STAR.flatMap(sx => STAR.map(sy => (
            <circle
              key={`${sx}-${sy}`}
              cx={MARGIN + sx * STONE}
              cy={MARGIN + sy * STONE}
              r={3}
              fill="#6b3a1f"
            />
          )))}
        </svg>

        {board.map((row, y) =>
          row.map((c, x) => {
            const isLast = lastMove && lastMove.x === x && lastMove.y === y
            return (
              <button
                key={`${x}-${y}`}
                type="button"
                onClick={() => onCell(x, y)}
                disabled={status !== 'playing' || turn !== 'X' || c !== null}
                className="absolute flex items-center justify-center"
                style={{
                  left: MARGIN + x * STONE - STONE / 2,
                  top: MARGIN + y * STONE - STONE / 2,
                  width: STONE,
                  height: STONE,
                  background: 'transparent',
                  cursor: c === null && status === 'playing' && turn === 'X' ? 'pointer' : 'default',
                }}
              >
                {c && (
                  <span
                    className="block rounded-full"
                    style={{
                      width: STONE * 0.82,
                      height: STONE * 0.82,
                      background: c === 'X'
                        ? 'radial-gradient(circle at 35% 30%, #4a4a4a, #0a0a0a 70%)'
                        : 'radial-gradient(circle at 35% 30%, #ffffff, #c8c8c8 80%)',
                      boxShadow: '0 2px 3px rgba(0,0,0,0.35)',
                      border: c === 'O' ? '1px solid #999' : 'none',
                      outline: isLast ? '2px solid #ef4444' : 'none',
                    }}
                  />
                )}
              </button>
            )
          })
        )}
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        {status === 'idle' && (
          <button
            type="button"
            onClick={start}
            className="px-8 py-3 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
          >
            开始对局
          </button>
        )}
        {status === 'over' && (
          <button
            type="button"
            onClick={start}
            className="px-8 py-3 rounded-full bg-fun-purple text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
          >
            再来一局
          </button>
        )}
      </div>
    </div>
  )
}
