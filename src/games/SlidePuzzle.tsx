import { useState, useCallback, useRef, useEffect } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Level = '简单' | '中等' | '复杂'
const LEVEL_N: Record<Level, number> = { 简单: 3, 中等: 4, 复杂: 5 }

function solvedBoard(n: number): number[] {
  const len = n * n
  const b: number[] = []
  for (let i = 1; i < len; i++) b.push(i)
  b.push(0)
  return b
}

function neighbors(n: number, i: number): number[] {
  const r = Math.floor(i / n)
  const c = i % n
  const out: number[] = []
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}

function swap(board: number[], i: number, j: number): number[] {
  const b = [...board]
  ;[b[i], b[j]] = [b[j], b[i]]
  return b
}

function shuffleBoard(n: number, scrambleMoves: number): number[] {
  let b = solvedBoard(n)
  for (let k = 0; k < scrambleMoves; k++) {
    const e = b.indexOf(0)
    const ns = neighbors(n, e)
    const j = ns[Math.floor(Math.random() * ns.length)]
    b = swap(b, e, j)
  }
  return b
}

function isSolved(board: number[], n: number): boolean {
  const sol = solvedBoard(n)
  return board.every((v, i) => v === sol[i])
}

function scoreFor(n: number, moves: number, seconds: number): number {
  const moveW = n <= 3 ? 15 : n <= 4 ? 12 : 8
  const timeW = n <= 3 ? 4 : n <= 4 ? 3 : 2
  return Math.max(0, 12000 - moves * moveW - seconds * timeW)
}

export default function SlidePuzzle({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const n = LEVEL_N[level]

  const [board, setBoard] = useState<number[]>(() => solvedBoard(LEVEL_N['中等']))
  const [status, setStatus] = useState<'idle' | 'playing' | 'won'>('idle')
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(0)
  const submittedRef = useRef(false)

  const submitWin = useCallback(
    async (size: number, finalMoves: number, seconds: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const s = scoreFor(size, finalMoves, seconds)
      try {
        await createRecord(userId, { gameId, score: s, duration: seconds, result: 'win' })
      } catch {}
    },
    [userId, gameId]
  )

  useEffect(() => {
    if (status !== 'playing' || startRef.current === 0) return
    const id = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)))
    }, 400)
    return () => window.clearInterval(id)
  }, [status, moves])

  const newRound = useCallback(() => {
    const size = LEVEL_N[level]
    setBoard(solvedBoard(size))
    setStatus('idle')
    setMoves(0)
    setElapsed(0)
    startRef.current = 0
    submittedRef.current = false
  }, [level])

  useEffect(() => {
    newRound()
  }, [level, newRound])

  const startGame = () => {
    const size = LEVEL_N[level]
    const scrambleMoves = size * size * 80
    setBoard(shuffleBoard(size, scrambleMoves))
    setMoves(0)
    setElapsed(0)
    setStatus('playing')
    startRef.current = 0
    submittedRef.current = false
  }

  const onTileClick = (idx: number) => {
    if (status !== 'playing') return
    const size = LEVEL_N[level]
    const e = board.indexOf(0)
    if (!neighbors(size, e).includes(idx)) return
    if (startRef.current === 0) startRef.current = Date.now()
    const next = swap(board, idx, e)
    const m = moves + 1
    setBoard(next)
    setMoves(m)
    if (isSolved(next, size)) {
      const sec = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000))
      setElapsed(sec)
      setStatus('won')
      void submitWin(size, m, sec)
    }
  }

  const picking = status === 'idle' || status === 'won'
  const cellPx = n >= 5 ? '2.5rem' : n >= 4 ? '3.25rem' : '3.75rem'

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-wrap gap-2 justify-center">
        {(Object.keys(LEVEL_N) as Level[]).map(lv => (
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
            {lv}（{LEVEL_N[lv]}×{LEVEL_N[lv]}）
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-fun-muted">
        <span>步数：<span className="text-fun-accent text-xl">{moves}</span></span>
        {status === 'playing' && startRef.current > 0 && (
          <span>
            用时：
            <span className="text-fun-purple text-xl">{elapsed}s</span>
          </span>
        )}
        {status === 'won' && <span>用时：<span className="text-fun-purple text-xl">{elapsed}s</span></span>}
      </div>

      {status === 'idle' && (
        <p className="text-sm text-fun-muted font-semibold text-center max-w-md">
          将滑块按 1～{n * n - 1} 顺序排好，空格在右下角。点击「开始」随机打乱（保证可解）。
        </p>
      )}

      <div
        className="grid gap-2 p-3 bg-fun-border rounded-3xl shadow-card"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {board.map((v, i) => (
          <button
            key={i}
            type="button"
            disabled={v === 0 || status !== 'playing'}
            onClick={() => onTileClick(i)}
            className={`rounded-2xl font-black border-2 flex items-center justify-center transition-all shadow-btn active:scale-95 ${
              v === 0
                ? 'bg-transparent border-transparent cursor-default'
                : 'border-fun-border bg-fun-card text-fun-text hover:border-fun-accent/50 hover:bg-fun-accent/5'
            } ${status !== 'playing' && v !== 0 ? 'opacity-90' : ''}`}
            style={{ width: cellPx, height: cellPx, fontSize: n >= 5 ? '0.95rem' : '1.15rem' }}
          >
            {v === 0 ? '' : v}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        {status === 'idle' && (
          <button
            type="button"
            onClick={startGame}
            className="px-8 py-3 rounded-full bg-fun-accent text-white font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
          >
            开始游戏
          </button>
        )}
        {(status === 'playing' || status === 'won') && (
          <button
            type="button"
            onClick={newRound}
            className="px-6 py-2 rounded-full border-2 border-fun-border text-fun-text font-bold bg-fun-bg hover:border-fun-accent/50 transition-all"
          >
            重置盘面
          </button>
        )}
      </div>

      {status === 'won' && (
        <div className="text-center bg-gradient-to-r from-fun-accent/20 to-fun-purple/20 border-2 border-fun-accent/40 rounded-3xl px-8 py-4 shadow-card">
          <p className="text-2xl font-black text-fun-text">完成！</p>
          <p className="text-fun-muted font-semibold mt-1">
            {moves} 步 · 得分 {scoreFor(n, moves, elapsed)}
          </p>
        </div>
      )}
    </div>
  )
}
