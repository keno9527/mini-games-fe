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
  简单: 'bg-green-100 text-green-700 border-green-200',
  中等: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  复杂: 'bg-red-100 text-red-600 border-red-200',
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
        <div className="w-12 h-12 border-4 border-fun-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-fun-muted font-semibold">加载中...</p>
      </div>
    )
  }

  if (error || !game || !id) {
    return (
      <div className="text-center py-32 text-fun-muted">
        <div className="text-5xl mb-4">😢</div>
        <p className="font-bold mb-4">{error || '游戏未找到'}</p>
        <Link to="/" className="text-fun-accent font-black hover:underline">← 回到大厅</Link>
      </div>
    )
  }

  const GameComponent = gameComponents[id]
  const levels = game.difficulties?.length ? game.difficulties : ['简单', '中等', '复杂']

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-fun-muted mb-6 font-semibold">
        <Link to="/" className="hover:text-fun-accent transition-colors">🎮 游戏大厅</Link>
        <span className="text-fun-border">›</span>
        <span className="text-fun-text font-bold">{game.name}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8 items-start">
        {/* Game area */}
        <div>
          <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-6 shadow-card">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <h1 className="text-3xl font-black text-fun-text">{game.name}</h1>
              {levels.map(lv => (
                <span
                  key={lv}
                  className={`text-xs font-bold px-3 py-1 rounded-full border-2 ${difficultyChip[lv] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                >
                  {lv}
                </span>
              ))}
              {game.tags.map(tag => (
                <span key={tag} className="text-xs font-bold px-3 py-1 rounded-full bg-fun-border text-fun-muted">
                  {tag}
                </span>
              ))}
            </div>

            {GameComponent ? (
              <GameComponent userId={currentUser?.id} gameId={id} />
            ) : (
              <div className="text-center py-20 text-fun-muted font-semibold">
                😅 该游戏暂未实现
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Game info */}
          <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-5 shadow-card">
            <h3 className="text-sm font-black text-fun-muted uppercase tracking-wider mb-3">📖 游戏介绍</h3>
            <p className="text-sm text-fun-text leading-relaxed font-semibold">{game.description}</p>
          </div>

          {/* Login reminder */}
          {!currentUser && (
            <div className="bg-orange-50 border-2 border-fun-accent/40 rounded-3xl p-5">
              <p className="text-sm font-bold text-fun-accent mb-3">🌟 登录后可以保存游戏记录哦！</p>
              <Link
                to="/profile"
                className="block text-center py-2.5 rounded-full bg-fun-accent text-white text-sm font-black shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition-all"
              >
                去创建账户
              </Link>
            </div>
          )}

          {currentUser && (
            <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-5 shadow-card">
              <p className="text-xs font-bold text-fun-muted mb-2">🎮 当前玩家</p>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fun-accent to-fun-pink flex items-center justify-center text-sm font-black text-white shadow-btn">
                  {currentUser.name[0]?.toUpperCase()}
                </div>
                <span className="text-base font-black text-fun-text">{currentUser.name}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
