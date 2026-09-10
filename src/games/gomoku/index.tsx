import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '@/api'
import '../game-surfaces.css'

interface Props {
  userId?: string
  gameId: string
}

type Cell = 'X' | 'O' | null
type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'playing' | 'over'

const SIZE = 15

const inBounds = (x: number, y: number) => x >= 0 && x < SIZE && y >= 0 && y < SIZE

function isWin(board: Cell[][], x: number, y: number, s: 'X' | 'O'): boolean {
  const dirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]
  for (const [dx, dy] of dirs) {
    let c = 1
    for (let k = 1; k < 5; k++) {
      const nx = x + dx * k,
        ny = y + dy * k
      if (!inBounds(nx, ny) || board[ny][nx] !== s) break
      c++
    }
    for (let k = 1; k < 5; k++) {
      const nx = x - dx * k,
        ny = y - dy * k
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
  const dirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ]
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
      const nx = x + dx,
        ny = y + dy
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

  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    },
    [],
  )
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
    [userId, gameId],
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
    [submitEnd],
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
      const working = b.map((r) => [...r])
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
      if (working.every((row) => row.every((c) => c !== null))) {
        endGame('draw')
        return
      }
      setTurn('X')
      setMessage('轮到你（黑）')
    },
    [level, endGame],
  )

  const onCell = (x: number, y: number) => {
    if (status !== 'playing' || turn !== 'X') return
    if (board[y][x] !== null) return
    const nb = board.map((r) => [...r])
    nb[y][x] = 'X'
    setBoard(nb)
    setLastMove({ x, y })
    if (isWin(nb, x, y, 'X')) {
      endGame('X')
      return
    }
    if (nb.every((row) => row.every((c) => c !== null))) {
      endGame('draw')
      return
    }
    setTurn('O')
    setMessage('电脑思考中…')
    aiTimerRef.current = setTimeout(() => playAI(nb), 260)
  }

  const picking = status === 'idle' || status === 'over'

  const moves = board.flat().filter(Boolean).length

  return (
    <section className="game-surface gomoku-room">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">GOMOKU · 黑白之间</p>
          <h2>一局，静心落子</h2>
        </div>
        <span className="gs-seal">弈</span>
      </header>
      <div className="gs-toolbar">
        <div className="gs-segments" aria-label="对局难度">
          {(['简单', '中等', '复杂'] as const).map((lv) => (
            <button
              key={lv}
              disabled={!picking}
              aria-pressed={level === lv}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        <span className="gs-caption">十五路棋盘 · 五子连珠</span>
      </div>
      <div className="gs-play-layout">
        <div className="gomoku-table">
          <div className="gs-seat">
            <span>
              <i className="gomoku-stone white" /> 电脑 · 白棋
            </span>
            <span>{turn === 'O' && status === 'playing' ? '思考中…' : '后手'}</span>
          </div>
          <div className="gomoku-frame">
            <div className="gomoku-board">
              <svg
                viewBox={`0 0 ${BOARD_PX} ${BOARD_PX}`}
                className="gomoku-lines"
                aria-hidden="true"
              >
                {Array.from({ length: SIZE }, (_, i) => (
                  <g key={i}>
                    <line
                      x1={MARGIN}
                      y1={MARGIN + i * STONE}
                      x2={BOARD_PX - MARGIN}
                      y2={MARGIN + i * STONE}
                    />
                    <line
                      x1={MARGIN + i * STONE}
                      y1={MARGIN}
                      x2={MARGIN + i * STONE}
                      y2={BOARD_PX - MARGIN}
                    />
                  </g>
                ))}
                {[
                  [3, 3],
                  [11, 3],
                  [7, 7],
                  [3, 11],
                  [11, 11],
                ].map(([x, y]) => (
                  <circle key={`${x}-${y}`} cx={MARGIN + x * STONE} cy={MARGIN + y * STONE} r="3" />
                ))}
                {Array.from({ length: SIZE }, (_, i) => (
                  <text key={i} x={MARGIN + i * STONE} y="11">
                    {String.fromCharCode(65 + i)}
                  </text>
                ))}
              </svg>
              {board.map((row, y) =>
                row.map((c, x) => (
                  <button
                    key={`${x}-${y}`}
                    className="gomoku-point"
                    aria-label={`${String.fromCharCode(65 + x)}${y + 1}，${c === 'X' ? '黑棋' : c === 'O' ? '白棋' : '空位'}`}
                    onClick={() => onCell(x, y)}
                    disabled={status !== 'playing' || turn !== 'X' || c !== null}
                    style={{
                      left: `${((MARGIN + x * STONE - STONE / 2) / BOARD_PX) * 100}%`,
                      top: `${((MARGIN + y * STONE - STONE / 2) / BOARD_PX) * 100}%`,
                      width: `${(STONE / BOARD_PX) * 100}%`,
                      height: `${(STONE / BOARD_PX) * 100}%`,
                    }}
                  >
                    {c && (
                      <span className={`gomoku-stone ${c === 'X' ? 'black' : 'white'}`}>
                        {lastMove?.x === x && lastMove.y === y && <i className="gomoku-last" />}
                      </span>
                    )}
                  </button>
                )),
              )}
            </div>
          </div>
          <div className="gs-seat">
            <span>
              <i className="gomoku-stone black" /> 你 · 黑棋
            </span>
            <span>{status === 'playing' && turn === 'X' ? '请落子' : '先手'}</span>
          </div>
        </div>
        <aside className="gs-sidebar">
          <div className="gs-panel">
            <p className="gs-eyebrow">对局状态</p>
            <h3 role="status">{message}</h3>
            <p>纵、横或斜向，率先连成五子即可获胜。</p>
            <div className="gs-stat">
              <span>已落子</span>
              <strong>
                {String(moves).padStart(2, '0')}
                <small> 手</small>
              </strong>
            </div>
          </div>
          {picking && (
            <button className="gs-primary" onClick={start}>
              {status === 'idle' ? '开始对局' : '再来一局'} <span>↗</span>
            </button>
          )}
          <div className="gs-help">
            <strong>黑白相间，步步为营</strong>
            <p>你执黑先行。棋心上的朱红小点标记最近一步。</p>
            <p>
              {level === '简单'
                ? '入门对弈，熟悉连珠棋形。'
                : level === '中等'
                  ? '电脑会攻守兼顾，留意两端的空位。'
                  : '电脑评估棋形，试着制造双重威胁。'}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
