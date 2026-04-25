import { useState, useCallback, useEffect } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type CellState = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

type Difficulty = '简单' | '中等' | '复杂'

const CONFIGS: Record<Difficulty, { rows: number; cols: number; mines: number; emoji: string }> = {
  简单: { rows: 9, cols: 9, mines: 10, emoji: '😊' },
  中等: { rows: 16, cols: 16, mines: 40, emoji: '😐' },
  复杂: { rows: 16, cols: 30, mines: 99, emoji: '😈' },
}

function createBoard(rows: number, cols: number, mines: number, skipR: number, skipC: number): CellState[][] {
  const board: CellState[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  )
  let placed = 0
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows)
    const c = Math.floor(Math.random() * cols)
    if (!board[r][c].mine && !(Math.abs(r - skipR) <= 1 && Math.abs(c - skipC) <= 1)) {
      board[r][c].mine = true
      placed++
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue
      let count = 0
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++
        }
      }
      board[r][c].adjacent = count
    }
  }
  return board
}

function reveal(board: CellState[][], r: number, c: number): CellState[][] {
  const b = board.map(row => row.map(cell => ({ ...cell })))
  const stack = [[r, c]]
  while (stack.length > 0) {
    const [cr, cc] = stack.pop()!
    const cell = b[cr][cc]
    if (cell.revealed || cell.flagged || cell.mine) continue
    cell.revealed = true
    if (cell.adjacent === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr, nc = cc + dc
          if (nr >= 0 && nr < b.length && nc >= 0 && nc < b[0].length && !b[nr][nc].revealed) {
            stack.push([nr, nc])
          }
        }
      }
    }
  }
  return b
}

const numColors = [
  '',
  'text-blue-600 font-black',
  'text-green-600 font-black',
  'text-red-500 font-black',
  'text-purple-600 font-black',
  'text-red-700 font-black',
  'text-cyan-600 font-black',
  'text-gray-800 font-black',
  'text-gray-500 font-black',
]

export default function Minesweeper({ userId, gameId }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('简单')
  const [board, setBoard] = useState<CellState[][] | null>(null)
  const [status, setStatus] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle')
  const [startTime, setStartTime] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [flagCount, setFlagCount] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const cfg = CONFIGS[difficulty]

  useEffect(() => {
    if (status !== 'playing') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500)
    return () => clearInterval(t)
  }, [status, startTime])

  const submitRecord = useCallback(async (result: 'win' | 'lose', duration: number, score: number) => {
    if (!userId || submitted) return
    setSubmitted(true)
    try {
      await createRecord(userId, { gameId, score, duration, result })
    } catch {}
  }, [userId, gameId, submitted])

  const startGame = useCallback((r: number, c: number) => {
    const b = createBoard(cfg.rows, cfg.cols, cfg.mines, r, c)
    const revealed = reveal(b, r, c)
    setBoard(revealed)
    setStatus('playing')
    setStartTime(Date.now())
    setElapsed(0)
    setFlagCount(0)
    setSubmitted(false)
  }, [cfg])

  const handleClick = (r: number, c: number) => {
    if (status === 'won' || status === 'lost') return

    if (status === 'idle') {
      startGame(r, c)
      return
    }

    if (!board) return
    const cell = board[r][c]
    if (cell.revealed || cell.flagged) return

    if (cell.mine) {
      const b = board.map(row => row.map(c2 => c2.mine ? { ...c2, revealed: true } : { ...c2 }))
      setBoard(b)
      setStatus('lost')
      const dur = Math.floor((Date.now() - startTime) / 1000)
      submitRecord('lose', dur, 0)
      return
    }

    const newBoard = reveal(board, r, c)
    setBoard(newBoard)

    const unrevealed = newBoard.flat().filter(c2 => !c2.revealed && !c2.mine)
    if (unrevealed.length === 0) {
      setStatus('won')
      const dur = Math.floor((Date.now() - startTime) / 1000)
      const score = Math.max(0, 1000 - dur * 3 + cfg.mines * 5)
      submitRecord('win', dur, score)
    }
  }

  const handleRightClick = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault()
    if (!board || status === 'idle' || status === 'won' || status === 'lost') return
    const cell = board[r][c]
    if (cell.revealed) return
    const b = board.map(row => row.map(c2 => ({ ...c2 })))
    b[r][c].flagged = !b[r][c].flagged
    setBoard(b)
    setFlagCount(prev => prev + (b[r][c].flagged ? 1 : -1))
  }

  const reset = () => {
    setBoard(null)
    setStatus('idle')
    setElapsed(0)
    setFlagCount(0)
    setSubmitted(false)
  }

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {(Object.keys(CONFIGS) as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => { setDifficulty(d); reset() }}
            className={`px-4 py-2 rounded-full text-sm font-black transition-all border-2 shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 ${
              difficulty === d
                ? 'bg-fun-accent text-white border-fun-accent'
                : 'border-fun-border text-fun-text hover:border-fun-accent/50 bg-fun-bg'
            }`}
          >
            {CONFIGS[d].emoji} {d}
          </button>
        ))}
        <div className="flex items-center gap-4 ml-2 text-sm font-bold text-fun-muted bg-fun-bg border-2 border-fun-border rounded-full px-4 py-2">
          <span>🚩 {cfg.mines - flagCount}</span>
          <span>⏱ {elapsed}s</span>
        </div>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-full text-sm font-bold border-2 border-fun-border text-fun-muted hover:border-fun-accent/50 hover:text-fun-text bg-fun-bg transition-all shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5"
        >
          🔄 重置
        </button>
      </div>

      {/* Status banner */}
      {status === 'won' && (
        <div className="text-fun-accent font-black text-xl animate-bounce bg-orange-50 border-2 border-fun-accent/30 px-6 py-2 rounded-full">
          🎉 太棒了，你赢了！
        </div>
      )}
      {status === 'lost' && (
        <div className="text-red-500 font-black text-xl bg-red-50 border-2 border-red-200 px-6 py-2 rounded-full">
          💥 踩到地雷啦！
        </div>
      )}

      {/* Board */}
      <div className="overflow-auto max-w-full" style={{ userSelect: 'none' }}>
        {status === 'idle' && (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cfg.cols}, 28px)` }}
          >
            {Array.from({ length: cfg.rows }, (_, r) =>
              Array.from({ length: cfg.cols }, (_, c) => (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleClick(r, c)}
                  onContextMenu={e => handleRightClick(e, r, c)}
                  className="w-7 h-7 rounded-lg bg-sky-100 border-2 border-sky-200 hover:bg-sky-300 cursor-pointer transition-colors"
                />
              ))
            )}
          </div>
        )}

        {board && (
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${cfg.cols}, 28px)` }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => {
                let content = ''
                let cellCls = 'w-7 h-7 rounded-lg text-xs flex items-center justify-center select-none transition-colors '
                if (cell.revealed) {
                  if (cell.mine) {
                    cellCls += 'bg-red-400 border-2 border-red-300'
                    content = '💣'
                  } else {
                    cellCls += 'bg-blue-50 border-2 border-blue-100 ' + (numColors[cell.adjacent] ?? '')
                    content = cell.adjacent > 0 ? String(cell.adjacent) : ''
                  }
                } else if (cell.flagged) {
                  cellCls += 'bg-yellow-100 border-2 border-yellow-300 cursor-pointer'
                  content = '🚩'
                } else {
                  cellCls += (status === 'won' || status === 'lost')
                    ? 'bg-sky-100 border-2 border-sky-200'
                    : 'bg-sky-100 border-2 border-sky-200 hover:bg-sky-300 cursor-pointer'
                }
                return (
                  <div
                    key={`${r}-${c}`}
                    className={cellCls}
                    onClick={() => handleClick(r, c)}
                    onContextMenu={e => handleRightClick(e, r, c)}
                  >
                    {content}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {(status === 'won' || status === 'lost') && (
        <button
          onClick={reset}
          className="px-8 py-3 rounded-full bg-fun-accent text-white font-black text-lg shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
        >
          再来一局 🎮
        </button>
      )}

      <p className="text-xs text-fun-muted font-semibold">👆 左键揭开 · 右键插旗</p>
    </div>
  )
}
