import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'playing' | 'over'
type Piece = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

const COLS = 10
const ROWS = 20
const CELL = 24

const PIECES: Piece[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

const SHAPES: Record<Piece, number[][][]> = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  O: [
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  ],
  T: [
    [[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  ],
  S: [
    [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
    [[1, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  ],
  Z: [
    [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [1, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]],
  ],
  J: [
    [[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
  ],
  L: [
    [[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 1, 0], [1, 0, 0, 0], [0, 0, 0, 0]],
    [[1, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  ],
}

const COLORS: Record<Piece, string> = {
  I: '#38bdf8',
  O: '#fbbf24',
  T: '#a855f7',
  S: '#34d399',
  Z: '#f87171',
  J: '#60a5fa',
  L: '#fb923c',
}

interface Active {
  type: Piece
  rot: number
  x: number
  y: number
}

const SPEED: Record<Level, { initial: number; min: number; step: number; per: number }> = {
  简单: { initial: 700, min: 280, step: 30, per: 10 },
  中等: { initial: 500, min: 180, step: 30, per: 10 },
  复杂: { initial: 330, min: 100, step: 22, per: 8 },
}

const LINE_SCORE = [0, 100, 300, 500, 800]

function randomPiece(): Piece {
  return PIECES[Math.floor(Math.random() * PIECES.length)]
}

function emptyBoard(): (Piece | null)[][] {
  return Array.from({ length: ROWS }, () => Array<Piece | null>(COLS).fill(null))
}

function collides(board: (Piece | null)[][], a: Active): boolean {
  const shape = SHAPES[a.type][a.rot]
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      if (!shape[dy][dx]) continue
      const x = a.x + dx
      const y = a.y + dy
      if (x < 0 || x >= COLS || y >= ROWS) return true
      if (y >= 0 && board[y][x]) return true
    }
  }
  return false
}

function merge(board: (Piece | null)[][], a: Active): (Piece | null)[][] {
  const nb = board.map(r => [...r])
  const shape = SHAPES[a.type][a.rot]
  for (let dy = 0; dy < 4; dy++) {
    for (let dx = 0; dx < 4; dx++) {
      if (!shape[dy][dx]) continue
      const y = a.y + dy
      const x = a.x + dx
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) nb[y][x] = a.type
    }
  }
  return nb
}

function clearFullLines(board: (Piece | null)[][]): { board: (Piece | null)[][]; cleared: number } {
  const kept = board.filter(row => row.some(c => c === null))
  const cleared = ROWS - kept.length
  const newRows = Array.from({ length: cleared }, () => Array<Piece | null>(COLS).fill(null))
  return { board: [...newRows, ...kept], cleared }
}

function spawn(type: Piece): Active {
  return { type, rot: 0, x: 3, y: 0 }
}

export default function Tetris({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [board, setBoard] = useState<(Piece | null)[][]>(emptyBoard)
  const [active, setActive] = useState<Active | null>(null)
  const [nextPiece, setNextPiece] = useState<Piece>(() => randomPiece())
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [status, setStatus] = useState<Status>('idle')

  const boardRef = useRef(board)
  const activeRef = useRef<Active | null>(active)
  const statusRef = useRef<Status>(status)
  const scoreRef = useRef(0)
  const linesRef = useRef(0)
  const startTimeRef = useRef(0)
  const submittedRef = useRef(false)

  boardRef.current = board
  activeRef.current = active
  statusRef.current = status
  scoreRef.current = score
  linesRef.current = lines

  const submitEnd = useCallback(async () => {
    if (!userId || submittedRef.current) return
    submittedRef.current = true
    const dur = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
    try {
      await createRecord(userId, { gameId, score: scoreRef.current, duration: dur, result: 'complete' })
    } catch {}
  }, [userId, gameId])

  const lockAndNext = useCallback(() => {
    const a = activeRef.current
    const b = boardRef.current
    if (!a) return
    const merged = merge(b, a)
    const { board: cleared, cleared: n } = clearFullLines(merged)
    boardRef.current = cleared
    setBoard(cleared)
    if (n > 0) {
      setScore(s => s + LINE_SCORE[n])
      setLines(l => l + n)
    }
    const nx = nextPiece
    const newActive = spawn(nx)
    if (collides(cleared, newActive)) {
      setActive(null)
      activeRef.current = null
      setStatus('over')
      statusRef.current = 'over'
      void submitEnd()
      return
    }
    setActive(newActive)
    activeRef.current = newActive
    setNextPiece(randomPiece())
  }, [nextPiece, submitEnd])

  const tryMove = useCallback((dx: number, dy: number): boolean => {
    const a = activeRef.current
    if (!a) return false
    const next: Active = { ...a, x: a.x + dx, y: a.y + dy }
    if (collides(boardRef.current, next)) return false
    setActive(next)
    activeRef.current = next
    return true
  }, [])

  const rotate = useCallback(() => {
    const a = activeRef.current
    if (!a) return
    const nextRot = (a.rot + 1) % 4
    for (const kick of [0, -1, 1, -2, 2]) {
      const next: Active = { ...a, rot: nextRot, x: a.x + kick }
      if (!collides(boardRef.current, next)) {
        setActive(next)
        activeRef.current = next
        return
      }
    }
  }, [])

  const hardDrop = useCallback(() => {
    const a = activeRef.current
    if (!a) return
    let drop = 0
    while (!collides(boardRef.current, { ...a, y: a.y + drop + 1 })) drop++
    const landed: Active = { ...a, y: a.y + drop }
    setActive(landed)
    activeRef.current = landed
    setScore(s => s + drop * 2)
    scoreRef.current += drop * 2
    lockAndNext()
  }, [lockAndNext])

  useEffect(() => {
    if (status !== 'playing') return
    const { initial, min, step, per } = SPEED[level]
    const speed = Math.max(min, initial - Math.floor(linesRef.current / per) * step)
    const timer = window.setInterval(() => {
      if (statusRef.current !== 'playing') return
      if (!tryMove(0, 1)) lockAndNext()
    }, speed)
    return () => window.clearInterval(timer)
  }, [status, level, lines, tryMove, lockAndNext])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (statusRef.current !== 'playing' || !activeRef.current) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); tryMove(-1, 0) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); tryMove(1, 0) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); rotate() }
      else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!tryMove(0, 1)) lockAndNext()
        else { setScore(s => s + 1); scoreRef.current += 1 }
      }
      else if (e.key === ' ') { e.preventDefault(); hardDrop() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tryMove, rotate, hardDrop, lockAndNext])

  const start = () => {
    const a = spawn(randomPiece())
    setBoard(emptyBoard())
    boardRef.current = emptyBoard()
    setActive(a)
    activeRef.current = a
    setNextPiece(randomPiece())
    setScore(0); scoreRef.current = 0
    setLines(0); linesRef.current = 0
    submittedRef.current = false
    startTimeRef.current = Date.now()
    setStatus('playing')
    statusRef.current = 'playing'
  }

  const reset = useCallback(() => {
    setBoard(emptyBoard())
    setActive(null)
    setScore(0); scoreRef.current = 0
    setLines(0); linesRef.current = 0
    setStatus('idle')
    statusRef.current = 'idle'
  }, [])

  useEffect(() => {
    reset()
  }, [level, reset])

  const pickingIdle = status === 'idle' || status === 'over'

  // 渲染：把当前活动方块叠到盘面
  const display: (Piece | null)[][] = board.map(r => [...r])
  if (active) {
    const shape = SHAPES[active.type][active.rot]
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 4; dx++) {
        if (!shape[dy][dx]) continue
        const y = active.y + dy
        const x = active.x + dx
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) display[y][x] = active.type
      }
    }
  }

  const nextShape = SHAPES[nextPiece][0]

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap gap-2 justify-center">
        {(['简单', '中等', '复杂'] as const).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!pickingIdle}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-purple text-white border-fun-purple'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-purple/50'
            } ${!pickingIdle ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-5">
        <div
          className="relative border-4 border-fun-border rounded-2xl overflow-hidden shadow-card"
          style={{ width: COLS * CELL, height: ROWS * CELL, background: '#1f1333' }}
        >
          {display.map((row, y) =>
            row.map((c, x) => (
              <div
                key={`${y}-${x}`}
                className="absolute"
                style={{
                  left: x * CELL,
                  top: y * CELL,
                  width: CELL,
                  height: CELL,
                  background: c ? COLORS[c] : 'transparent',
                  border: c ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.03)',
                  boxSizing: 'border-box',
                }}
              />
            ))
          )}
          {status === 'idle' && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 text-white">
              <p className="text-xl font-black">🧱 准备好了吗？</p>
              <button
                type="button"
                onClick={start}
                className="px-6 py-2 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
              >
                开始游戏
              </button>
              <p className="text-xs font-semibold opacity-80">← → 移动 · ↑ 旋转 · ↓ 加速 · 空格 硬降</p>
            </div>
          )}
          {status === 'over' && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-white">
              <p className="text-3xl">💥</p>
              <p className="text-xl font-black">顶格啦！</p>
              <p className="text-sm">得分 <span className="text-fun-yellow font-black text-2xl">{score}</span></p>
              <button
                type="button"
                onClick={start}
                className="mt-2 px-6 py-2 rounded-full bg-fun-purple text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
              >
                再来一局
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 min-w-[120px]">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl px-3 py-2 text-center shadow-card">
            <p className="text-2xl font-black text-fun-accent">⭐ {score}</p>
            <p className="text-xs text-fun-muted font-semibold mt-0.5">得分</p>
          </div>
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl px-3 py-2 text-center shadow-card">
            <p className="text-2xl font-black text-fun-green">🧱 {lines}</p>
            <p className="text-xs text-fun-muted font-semibold mt-0.5">消行</p>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-2 shadow-card">
            <p className="text-xs text-fun-muted font-semibold text-center mb-1">下一块</p>
            <div
              className="relative mx-auto"
              style={{ width: 4 * 16, height: 4 * 16 }}
            >
              {nextShape.map((row, y) =>
                row.map((c, x) =>
                  c ? (
                    <div
                      key={`${y}-${x}`}
                      className="absolute rounded-sm"
                      style={{
                        left: x * 16,
                        top: y * 16,
                        width: 16,
                        height: 16,
                        background: COLORS[nextPiece],
                        border: '1px solid rgba(0,0,0,0.15)',
                      }}
                    />
                  ) : null
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
