import { useGamePlay } from '@/hooks/useGamePlay'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createRecord } from '@/api'
import '../game-surfaces.css'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
type Status = 'idle' | 'playing' | 'paused' | 'over'
type Piece = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'

const COLS = 10
const ROWS = 20

const PIECES: Piece[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

const SHAPES: Record<Piece, number[][][]> = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  O: [
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  T: [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
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
  const nb = board.map((r) => [...r])
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
  const kept = board.filter((row) => row.some((c) => c === null))
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
  useGamePlay(gameId, status === 'playing' || status === 'paused' ? status : 'idle')

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
      await createRecord(userId, {
        gameId,
        score: scoreRef.current,
        duration: dur,
        result: 'complete',
      })
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
      scoreRef.current += LINE_SCORE[n]
      setScore(scoreRef.current)
      setLines((l) => l + n)
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
    if (!a || statusRef.current !== 'playing') return false
    const next: Active = { ...a, x: a.x + dx, y: a.y + dy }
    if (collides(boardRef.current, next)) return false
    setActive(next)
    activeRef.current = next
    return true
  }, [])

  const rotate = useCallback(() => {
    const a = activeRef.current
    if (!a || statusRef.current !== 'playing') return
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
    if (!a || statusRef.current !== 'playing') return
    let drop = 0
    while (!collides(boardRef.current, { ...a, y: a.y + drop + 1 })) drop++
    const landed: Active = { ...a, y: a.y + drop }
    setActive(landed)
    activeRef.current = landed
    setScore((s) => s + drop * 2)
    scoreRef.current += drop * 2
    lockAndNext()
  }, [lockAndNext])

  const softDrop = useCallback(() => {
    if (statusRef.current !== 'playing') return
    if (!tryMove(0, 1)) lockAndNext()
    else {
      scoreRef.current += 1
      setScore(scoreRef.current)
    }
  }, [tryMove, lockAndNext])

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
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        tryMove(-1, 0)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        tryMove(1, 0)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        rotate()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        softDrop()
      } else if (e.key === ' ') {
        e.preventDefault()
        hardDrop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tryMove, rotate, hardDrop, softDrop])

  const start = () => {
    const a = spawn(randomPiece())
    setBoard(emptyBoard())
    boardRef.current = emptyBoard()
    setActive(a)
    activeRef.current = a
    setNextPiece(randomPiece())
    setScore(0)
    scoreRef.current = 0
    setLines(0)
    linesRef.current = 0
    submittedRef.current = false
    startTimeRef.current = Date.now()
    setStatus('playing')
    statusRef.current = 'playing'
  }

  const reset = useCallback(() => {
    setBoard(emptyBoard())
    setActive(null)
    setScore(0)
    scoreRef.current = 0
    setLines(0)
    linesRef.current = 0
    setStatus('idle')
    statusRef.current = 'idle'
  }, [])

  useEffect(() => {
    reset()
  }, [level, reset])

  const pickingIdle = status === 'idle' || status === 'over'

  // 渲染：把当前活动方块叠到盘面
  const display: (Piece | null)[][] = board.map((r) => [...r])
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

  const ghostCells = new Set<string>()
  if (active) {
    let ghostY = active.y
    while (!collides(board, { ...active, y: ghostY + 1 })) ghostY++
    SHAPES[active.type][active.rot].forEach((row, dy) =>
      row.forEach((cell, dx) => {
        if (cell && ghostY + dy >= 0) ghostCells.add(`${ghostY + dy}-${active.x + dx}`)
      }),
    )
  }
  const nextShape = SHAPES[nextPiece][0]
  const togglePause = () => {
    const next = statusRef.current === 'playing' ? 'paused' : 'playing'
    statusRef.current = next
    setStatus(next)
  }

  return (
    <section className="game-surface tetris-room">
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">BLOCK STUDIO · 方块实验室</p>
          <h2>让每一块，恰到好处</h2>
        </div>
        <span className="tetris-logo" aria-hidden="true">
          ▦
        </span>
      </header>
      <div className="gs-toolbar">
        <div className="gs-segments" aria-label="下落难度">
          {(['简单', '中等', '复杂'] as const).map((lv) => (
            <button
              key={lv}
              disabled={!pickingIdle}
              aria-pressed={level === lv}
              onClick={() => setLevel(lv)}
            >
              {lv}
            </button>
          ))}
        </div>
        <span className="gs-caption">堆叠 · 消除 · 突破</span>
      </div>
      <div className="tetris-console">
        <div className="tetris-board-frame">
          <div
            className="tetris-board"
            role="img"
            aria-label={`俄罗斯方块棋盘，已消除 ${lines} 行，得分 ${score}`}
          >
            {display.map((row, y) =>
              row.map((c, x) => (
                <div
                  key={`${y}-${x}`}
                  className={`tetris-cell ${c ? 'is-filled' : ghostCells.has(`${y}-${x}`) ? 'is-ghost' : ''}`}
                  style={{
                    left: `${(x / COLS) * 100}%`,
                    top: `${(y / ROWS) * 100}%`,
                    width: `${100 / COLS}%`,
                    height: `${100 / ROWS}%`,
                    backgroundColor: c ? COLORS[c] : undefined,
                  }}
                />
              )),
            )}
          </div>
          {status !== 'playing' && (
            <div className="gs-overlay">
              <span className="gs-eyebrow">
                {status === 'paused'
                  ? 'TAKE A BREATH'
                  : status === 'over'
                    ? 'GAME OVER'
                    : 'READY TO STACK'}
              </span>
              <div className="tetris-splash" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <h3>
                {status === 'idle'
                  ? '下一块，无限可能'
                  : status === 'paused'
                    ? '休息一下'
                    : '本局结束'}
              </h3>
              <p>
                {status === 'over'
                  ? `得分 ${score} · 消除 ${lines} 行`
                  : status === 'paused'
                    ? '准备好后，继续你的节奏。'
                    : '填满一行，创造新的空间。'}
              </p>
              <button className="gs-primary" onClick={status === 'paused' ? togglePause : start}>
                {status === 'paused' ? '继续游戏' : status === 'over' ? '再来一局' : '开始游戏'} ↗
              </button>
            </div>
          )}
        </div>
        <aside className="tetris-sidebar">
          <div className="gs-panel">
            <p className="gs-eyebrow">SCORE · 得分</p>
            <strong className="tetris-score">{String(score).padStart(5, '0')}</strong>
            <div className="gs-stat">
              <span>消除行数</span>
              <strong>{lines}</strong>
            </div>
            <div className="gs-stat">
              <span>速度等级</span>
              <strong>{Math.floor(lines / SPEED[level].per) + 1}</strong>
            </div>
          </div>
          <div className="gs-panel tetris-next">
            <p className="gs-eyebrow">NEXT · 下一块</p>
            <div className="tetris-preview" role="img" aria-label={`下一块 ${nextPiece}`}>
              {nextShape.map((row, y) =>
                row.map((c, x) => (
                  <span
                    key={`${y}-${x}`}
                    className={c ? 'tetris-cell is-filled' : ''}
                    style={{ backgroundColor: c ? COLORS[nextPiece] : undefined }}
                  />
                )),
              )}
            </div>
          </div>
          {(status === 'playing' || status === 'paused') && (
            <button className="gs-secondary" onClick={togglePause}>
              {status === 'paused' ? '继续游戏' : '暂停游戏'}
            </button>
          )}
          <div className="gs-help">
            <strong>操作指南</strong>
            <p>
              ← → 左右移动
              <br />↑ 旋转 · ↓ 加速
              <br />
              空格 直接落下
            </p>
            <p>虚线标记落点，提前安排下一步。</p>
          </div>
        </aside>
      </div>
      <div className="tetris-controls" aria-label="触屏操作">
        <button disabled={status !== 'playing'} onClick={() => tryMove(-1, 0)} aria-label="左移">
          ←
        </button>
        <button disabled={status !== 'playing'} onClick={rotate} aria-label="旋转">
          ↻
        </button>
        <button disabled={status !== 'playing'} onClick={softDrop} aria-label="下移">
          ↓
        </button>
        <button disabled={status !== 'playing'} onClick={() => tryMove(1, 0)} aria-label="右移">
          →
        </button>
        <button disabled={status !== 'playing'} onClick={hardDrop}>
          落下 ⤓
        </button>
      </div>
    </section>
  )
}
