import { useState, useCallback, useRef, useEffect } from 'react'
import { createRecord } from '../api'

interface Props {
  userId?: string
  gameId: string
}

type Cell = 'X' | 'O' | null
type Level = '简单' | '中等' | '复杂'

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function checkTerminal(b: Cell[]): 'X' | 'O' | 'draw' | null {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a] as 'X' | 'O'
  }
  if (b.every(x => x !== null)) return 'draw'
  return null
}

function emptyIndices(b: Cell[]) {
  return b.map((v, i) => (v === null ? i : -1)).filter(i => i >= 0)
}

function randomMove(b: Cell[]): number {
  const e = emptyIndices(b)
  return e[Math.floor(Math.random() * e.length)]
}

function mediumMove(b: Cell[]): number {
  const tryWin = (sym: 'X' | 'O') => {
    for (const i of emptyIndices(b)) {
      const nb = [...b] as Cell[]
      nb[i] = sym
      if (checkTerminal(nb) === sym) return i
    }
    return -1
  }
  const win = tryWin('O')
  if (win >= 0) return win
  const block = tryWin('X')
  if (block >= 0) return block
  if (b[4] === null) return 4
  const corners = [0, 2, 6, 8].filter(i => b[i] === null)
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)]
  return randomMove(b)
}

function minimax(b: Cell[], isOMax: boolean): number {
  const t = checkTerminal(b)
  if (t === 'O') return 10
  if (t === 'X') return -10
  if (t === 'draw') return 0

  if (isOMax) {
    let best = -Infinity
    for (const i of emptyIndices(b)) {
      const nb = [...b] as Cell[]
      nb[i] = 'O'
      best = Math.max(best, minimax(nb, false))
    }
    return best
  }
  let best = Infinity
  for (const i of emptyIndices(b)) {
    const nb = [...b] as Cell[]
    nb[i] = 'X'
    best = Math.min(best, minimax(nb, true))
  }
  return best
}

function hardMove(b: Cell[]): number {
  let best = -Infinity
  let pick = -1
  for (const i of emptyIndices(b)) {
    const nb = [...b] as Cell[]
    nb[i] = 'O'
    const sc = minimax(nb, false)
    if (sc > best) {
      best = sc
      pick = i
    }
  }
  return pick >= 0 ? pick : randomMove(b)
}

function aiPick(b: Cell[], level: Level): number {
  if (level === '简单') return randomMove(b)
  if (level === '中等') return mediumMove(b)
  return hardMove(b)
}

export default function TicTacToe({ userId, gameId }: Props) {
  const [level, setLevel] = useState<Level>('中等')
  const [board, setBoard] = useState<Cell[]>(() => Array(9).fill(null))
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle')
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [message, setMessage] = useState('你是 X，先手。点格落子。')
  const startRef = useRef(0)
  const submittedRef = useRef(false)

  const submitEnd = useCallback(
    async (result: 'win' | 'lose' | 'complete', score: number) => {
      if (!userId || submittedRef.current) return
      submittedRef.current = true
      const dur = Math.max(1, Math.floor((Date.now() - startRef.current) / 1000))
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
        setMessage('你赢了！')
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
    setBoard(Array(9).fill(null))
    setStatus('idle')
    setTurn('X')
    setMessage('你是 X，先手。点「开始对局」。')
    submittedRef.current = false
    startRef.current = 0
  }, [])

  useEffect(() => {
    reset()
  }, [level, reset])

  const start = () => {
    setBoard(Array(9).fill(null))
    setStatus('playing')
    setTurn('X')
    setMessage('轮到你（X）')
    submittedRef.current = false
    startRef.current = Date.now()
  }

  const playO = useCallback(
    (b: Cell[]) => {
      const i = aiPick(b, level)
      if (i < 0) return
      const nb = [...b] as Cell[]
      nb[i] = 'O'
      setBoard(nb)
      const t = checkTerminal(nb)
      if (t) {
        endGame(t)
      } else {
        setTurn('X')
        setMessage('轮到你（X）')
      }
    },
    [level, endGame]
  )

  const onCell = (idx: number) => {
    if (status !== 'playing' || turn !== 'X') return
    if (board[idx] !== null) return
    const nb = [...board] as Cell[]
    nb[idx] = 'X'
    setBoard(nb)
    const t = checkTerminal(nb)
    if (t) {
      endGame(t)
      return
    }
    setTurn('O')
    setMessage('电脑思考中…')
    window.setTimeout(() => playO(nb), 280)
  }

  const picking = status === 'idle' || status === 'over'

  return (
    <div className="flex flex-col items-center gap-5">
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
            {lv === '中等' && ' · 会堵'}
            {lv === '复杂' && ' · 最优'}
          </button>
        ))}
      </div>

      <p className="text-sm font-bold text-fun-text min-h-[1.5rem]">{message}</p>

      <div className="grid grid-cols-3 gap-2 p-3 bg-fun-border rounded-3xl shadow-card">
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            disabled={status !== 'playing' || turn !== 'X' || c !== null}
            onClick={() => onCell(i)}
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 font-black text-3xl transition-all shadow-btn ${
              c === 'X'
                ? 'bg-sky-100 border-sky-400 text-sky-800'
                : c === 'O'
                  ? 'bg-orange-100 border-orange-400 text-orange-800'
                  : 'bg-fun-card border-fun-border text-transparent hover:border-fun-accent/40'
            } ${status === 'playing' && turn === 'X' && c === null ? 'cursor-pointer hover:bg-fun-accent/5' : 'cursor-default'}`}
          >
            {c ?? ''}
          </button>
        ))}
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
