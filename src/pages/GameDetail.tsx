import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getGame } from '../api'
import { useUserStore } from '../store/userStore'
import Minesweeper from '../games/Minesweeper'
import Snake from '../games/Snake'
import TwentyFourPoints from '../games/TwentyFourPoints'
import Game2048 from '../games/Game2048'
import MemoryCard from '../games/MemoryCard'
import WhackAMole from '../games/WhackAMole'
import SlidePuzzle from '../games/SlidePuzzle'
import ReactionTest from '../games/ReactionTest'
import TicTacToe from '../games/TicTacToe'
import Tetris from '../games/Tetris'
import Breakout from '../games/Breakout'
import Wordle from '../games/Wordle'
import Gomoku from '../games/Gomoku'
import type { Game } from '../types'

const gameComponents: Record<string, React.ComponentType<{ userId?: string; gameId: string }>> = {
  minesweeper: Minesweeper,
  snake: Snake,
  '24points': TwentyFourPoints,
  '2048': Game2048,
  memory: MemoryCard,
  'whack-a-mole': WhackAMole,
  'slide-puzzle': SlidePuzzle,
  'reaction-test': ReactionTest,
  'tic-tac-toe': TicTacToe,
  tetris: Tetris,
  breakout: Breakout,
  wordle: Wordle,
  gomoku: Gomoku,
}

const difficultyChip: Record<string, string> = {
  简单: 'bg-transparent text-crt-green border-crt-green',
  中等: 'bg-transparent text-crt-yellow border-crt-yellow',
  复杂: 'bg-transparent text-crt-pink border-crt-pink',
}

export default function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const { currentUser } = useUserStore()
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getGame(id)
      .then(setGame)
      .catch(() => setError('游戏不存在'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col items-center py-32 gap-4">
        <div className="font-pixel text-crt-yellow text-sm tracking-widest animate-blink">
          LOADING...
        </div>
        <div className="font-mono-crt text-crt-cyan text-lg tracking-widest">
          ▓▓▓▓▒▒▒▒
        </div>
      </div>
    )
  }

  if (error || !game || !id) {
    return (
      <div className="text-center py-32">
        <div className="font-pixel text-3xl text-crt-pink mb-6 tracking-widest" style={{ textShadow: '0 0 12px #FF2EC8' }}>
          GAME OVER
        </div>
        <p className="font-mono-crt text-crt-text text-lg mb-6 tracking-wide">{error || 'GAME NOT FOUND'}</p>
        <Link to="/" className="inline-block font-pixel text-xs text-crt-cyan border-2 border-crt-cyan px-6 py-3 tracking-widest hover:bg-crt-cyan hover:text-black transition-all">
          ← BACK TO HALL
        </Link>
      </div>
    )
  }

  const GameComponent = gameComponents[id]
  const levels = game.difficulties?.length ? game.difficulties : ['简单', '中等', '复杂']

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono-crt text-sm text-crt-text-dim mb-6 tracking-wider">
        <Link to="/" className="hover:text-crt-cyan transition-colors">&gt; GAME HALL</Link>
        <span className="text-crt-border">/</span>
        <span className="text-crt-yellow font-pixel text-[10px] tracking-widest">{game.name}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8 items-start">
        {/* Game area - CRT 曲面屏外壳 */}
        <div>
          <div className="bg-crt-bg-card border-4 border-black rounded-2xl p-6 shadow-crt-card relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-60" />
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <h1 className="font-pixel text-xl md:text-2xl text-crt-cyan tracking-widest" style={{ textShadow: '0 0 10px #00F0FF' }}>
                  {game.name}
                </h1>
                {levels.map(lv => (
                  <span
                    key={lv}
                    className={`font-pixel text-[9px] px-3 py-1 border-2 tracking-widest ${difficultyChip[lv] ?? 'bg-transparent text-crt-text-dim border-crt-border'}`}
                  >
                    {lv}
                  </span>
                ))}
                {game.tags.map(tag => (
                  <span key={tag} className="font-mono-crt text-xs px-2 py-1 bg-black border border-crt-border text-crt-text-dim tracking-wider">
                    #{tag}
                  </span>
                ))}
              </div>

              {GameComponent ? (
                <GameComponent userId={currentUser?.id} gameId={id} />
              ) : (
                <div className="text-center py-20 font-pixel text-crt-yellow tracking-widest">
                  COMING SOON...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Game info */}
          <div className="bg-crt-bg-card border-2 border-crt-cyan shadow-crt-card p-5">
            <h3 className="font-pixel text-[10px] text-crt-cyan tracking-widest mb-3" style={{ textShadow: '0 0 6px #00F0FF' }}>
              ▸ INTRO
            </h3>
            <p className="font-mono-crt text-base text-crt-text leading-relaxed tracking-wide">{game.description}</p>
          </div>

          {/* Login reminder */}
          {!currentUser && (
            <div className="bg-crt-bg-card border-2 border-crt-yellow shadow-crt-card p-5">
              <p className="font-mono-crt text-sm text-crt-yellow mb-4 tracking-wide">
                &gt; LOGIN TO SAVE YOUR RECORDS
              </p>
              <Link
                to="/profile"
                className="block text-center py-2.5 bg-crt-yellow text-black font-pixel text-[10px] tracking-widest shadow-[0_0_10px_#FFE500] hover:shadow-[0_0_18px_#FFE500] transition-all"
              >
                CREATE ACCOUNT
              </Link>
            </div>
          )}

          {currentUser && (
            <div className="bg-crt-bg-card border-2 border-crt-pink shadow-crt-card p-5">
              <p className="font-pixel text-[10px] text-crt-pink mb-3 tracking-widest" style={{ textShadow: '0 0 6px #FF2EC8' }}>
                ▸ PLAYER 1
              </p>
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 bg-gradient-to-br from-crt-pink to-crt-purple flex items-center justify-center font-pixel text-sm text-white border-2 border-crt-yellow"
                  style={{ imageRendering: 'pixelated' }}
                >
                  {currentUser.name[0]?.toUpperCase()}
                </div>
                <span className="font-mono-crt text-lg text-crt-text tracking-wide">{currentUser.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
