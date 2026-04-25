import { useState, useEffect, useCallback, useRef } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Board = number[][]
type Dir = 'left' | 'right' | 'up' | 'down'
type Level = '简单' | '中等' | '复杂'

const LEVEL: Record<Level, { n: number; target: number; cellClass: string }> = {
  简单: { n: 3, target: 256, cellClass: 'w-[4.25rem] h-[4.25rem] text-2xl' },
  中等: { n: 4, target: 2048, cellClass: 'w-20 h-20 text-2xl' },
  复杂: { n: 5, target: 2048, cellClass: 'w-[3.1rem] h-[3.1rem] text-base' },
}

function emptyBoard(n: number): Board {
  return Array.from({ length: n }, () => Array(n).fill(0))
}

function addRandom(board: Board, n: number): Board {
  const b = board.map(r => [...r])
  const empties: [number, number][] = []
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (b[r][c] === 0) empties.push([r, c])
  if (empties.length === 0) return b
  const [r, c] = empties[Math.floor(Math.random() * empties.length)]
  b[r][c] = Math.random() < 0.9 ? 2 : 4
  return b
}

function initBoard(n: number): Board {
  let b = emptyBoard(n)
  b = addRandom(b, n)
  b = addRandom(b, n)
  return b
}

function compressRow(row: number[]): { row: number[]; score: number } {
  const n = row.length
  const nonZero = row.filter(x => x !== 0)
  const merged: number[] = []
  let score = 0
  let i = 0
  while (i < nonZero.length) {
    if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
      const val = nonZero[i] * 2
      merged.push(val)
      score += val
      i += 2
    } else {
      merged.push(nonZero[i])
      i++
    }
  }
  while (merged.length < n) merged.push(0)
  return { row: merged, score }
}

function moveBoard(board: Board, dir: Dir, n: number): { board: Board; score: number; moved: boolean } {
  let b = board.map(r => [...r])
  let totalScore = 0
  let moved = false

  const transpose = (m: Board): Board =>
    Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => m[c][r]))

  if (dir === 'up' || dir === 'down') b = transpose(b)

  for (let r = 0; r < n; r++) {
    const row = dir === 'right' || dir === 'down' ? [...b[r]].reverse() : [...b[r]]
    const { row: merged, score } = compressRow(row)
    const finalRow = dir === 'right' || dir === 'down' ? merged.reverse() : merged
    if (finalRow.join() !== b[r].join()) moved = true
    b[r] = finalRow
    totalScore += score
  }

  if (dir === 'up' || dir === 'down') b = transpose(b)
  return { board: b, score: totalScore, moved }
}

function canMove(board: Board, n: number): boolean {
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (board[r][c] === 0) return true
      if (c < n - 1 && board[r][c] === board[r][c + 1]) return true
      if (r < n - 1 && board[r][c] === board[r + 1][c]) return true
    }
  return false
}

const cellColors: Record<number, { bg: string; text: string }> = {
  0: { bg: 'bg-fun-border/60', text: 'text-transparent' },
  2: { bg: 'bg-orange-100', text: 'text-orange-800' },
  4: { bg: 'bg-orange-200', text: 'text-orange-900' },
  8: { bg: 'bg-orange-400', text: 'text-white' },
  16: { bg: 'bg-orange-500', text: 'text-white' },
  32: { bg: 'bg-red-400', text: 'text-white' },
  64: { bg: 'bg-red-500', text: 'text-white' },
  128: { bg: 'bg-yellow-400', text: 'text-white' },
  256: { bg: 'bg-yellow-500', text: 'text-white' },
  512: { bg: 'bg-fun-green', text: 'text-white' },
  1024: { bg: 'bg-fun-sky', text: 'text-white' },
  2048: { bg: 'bg-gradient-to-br from-fun-accent to-fun-purple', text: 'text-white' },
}

function cellStyle(val: number) {
  return cellColors[val] ?? { bg: 'bg-fun-purple', text: 'text-white' }
}

export default function Game2048({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const { n, target, cellClass } = LEVEL[level]

  const [board, setBoard] = useState<Board>(() => initBoard(LEVEL['中等'].n))
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [status, setStatus] = useState<'playing' | 'won' | 'over'>('playing')
  const [hitTarget, setHitTarget] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const startTimeRef = useRef(Date.now())
  const submittedRef = useRef(false)
  const hasMovedRef = useRef(false)
  const scoreRef = useRef(0)
  scoreRef.current = score

  const submitRecord = useCallback(async (s: number, result: 'win' | 'complete') => {
    if (!userId || submittedRef.current) return
    submittedRef.current = true
    setSubmitted(true)
    const dur = Math.floor((Date.now() - startTimeRef.current) / 1000)
    try {
      await createRecord(userId, { gameId, score: s, duration: dur, result })
    } catch {}
  }, [userId, gameId])

  const reset = useCallback(() => {
    const size = LEVEL[level].n
    setBoard(initBoard(size))
    setScore(0)
    setStatus('playing')
    setHitTarget(false)
    setSubmitted(false)
    submittedRef.current = false
    hasMovedRef.current = false
    startTimeRef.current = Date.now()
  }, [level])

  useEffect(() => {
    const size = LEVEL[level].n
    setBoard(initBoard(size))
    setScore(0)
    setStatus('playing')
    setHitTarget(false)
    setSubmitted(false)
    submittedRef.current = false
    hasMovedRef.current = false
    startTimeRef.current = Date.now()
  }, [level])

  const move = useCallback(
    (dir: Dir) => {
      if (status === 'over') return
      const size = LEVEL[level].n
      const tgt = LEVEL[level].target
      setBoard(prev => {
        const { board: newBoard, score: gained, moved } = moveBoard(prev, dir, size)
        if (!moved) return prev

        const withNew = addRandom(newBoard, size)
        hasMovedRef.current = true
        const newScore = scoreRef.current + gained
        setScore(newScore)
        setBestScore(b => Math.max(b, newScore))

        const maxTile = withNew.flat().reduce((a, b) => Math.max(a, b), 0)
        if (maxTile >= tgt) setHitTarget(true)

        if (!canMove(withNew, size)) {
          setStatus('over')
          if (!submittedRef.current) submitRecord(newScore, 'complete')
        }

        return withNew
      })
    },
    [status, level, submitRecord]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down',
      }
      const d = map[e.key]
      if (!d) return
      e.preventDefault()
      move(d)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left')
    else move(dy > 0 ? 'down' : 'up')
    touchStart.current = null
  }

  const picking = status === 'over' || !hasMovedRef.current

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.keys(LEVEL) as Level[]).map(lv => (
          <button
            key={lv}
            type="button"
            disabled={!picking}
            onClick={() => setLevel(lv)}
            className={`px-4 py-2 rounded-full text-sm font-black border-2 transition-all ${
              level === lv
                ? 'bg-fun-accent text-white border-fun-accent'
                : 'border-fun-border text-fun-text bg-fun-bg hover:border-fun-accent/50'
            } ${!picking ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {lv}（{LEVEL[lv].n}×{LEVEL[lv].n} / {LEVEL[lv].target}）
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 flex-wrap justify-center">
        <div className="bg-fun-accent/10 border-2 border-fun-accent/30 rounded-2xl px-6 py-3 text-center shadow-card min-w-[110px]">
          <p className="text-2xl font-black text-fun-accent">{score}</p>
          <p className="text-xs text-fun-muted font-semibold">当前分数</p>
        </div>
        <div className="bg-fun-border/60 border-2 border-fun-border rounded-2xl px-6 py-3 text-center min-w-[110px]">
          <p className="text-2xl font-black text-fun-text">{bestScore}</p>
          <p className="text-xs text-fun-muted font-semibold">最高分 🏆</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-full bg-fun-accent text-white font-black text-sm shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
        >
          🔄 新游戏
        </button>
      </div>

      {hitTarget && status === 'playing' && (
        <div className="bg-gradient-to-r from-fun-accent to-fun-purple text-white font-black text-lg px-6 py-2 rounded-full shadow-btn animate-bounce">
          🎉 达到 {target}！继续挑战更高吧！
        </div>
      )}

      <div
        className="bg-fun-border rounded-3xl p-3 shadow-card select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {board.map((row, r) =>
            row.map((val, c) => {
              const { bg, text } = cellStyle(val)
              return (
                <div
                  key={`${r}-${c}`}
                  className={`${bg} ${text} ${cellClass} rounded-2xl flex items-center justify-center font-black transition-all duration-100 shadow-card`}
                >
                  {val !== 0 ? val : ''}
                </div>
              )
            })
          )}
        </div>
      </div>

      {status === 'over' && (
        <div className="text-center bg-fun-card border-2 border-fun-border rounded-3xl p-8 shadow-card space-y-3">
          <div className="text-4xl">😢</div>
          <p className="text-2xl font-black text-fun-text">游戏结束！</p>
          <p className="text-fun-muted font-semibold">得分：<span className="text-fun-accent font-black text-2xl">{score}</span></p>
          <button
            type="button"
            onClick={reset}
            className="px-8 py-3 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
          >
            再来一次 🎮
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          [null, { label: '↑', dir: 'up' as Dir }, null],
          [{ label: '←', dir: 'left' as Dir }, { label: '·', dir: null }, { label: '→', dir: 'right' as Dir }],
          [null, { label: '↓', dir: 'down' as Dir }, null],
        ].map((row, ri) =>
          row.map((btn, ci) =>
            btn && btn.dir ? (
              <button
                type="button"
                key={`${ri}-${ci}`}
                onClick={() => move(btn.dir as Dir)}
                className="w-12 h-12 rounded-2xl bg-fun-card border-2 border-fun-border text-fun-text font-black hover:bg-fun-accent/10 hover:border-fun-accent/40 active:scale-95 transition-all shadow-btn text-sm"
              >
                {btn.label}
              </button>
            ) : (
              <div key={`${ri}-${ci}`} />
            )
          )
        )}
      </div>

      <p className="text-xs text-fun-muted font-semibold">方向键 / WASD 移动，合并到 {target} 🎯</p>
    </div>
  )
}
