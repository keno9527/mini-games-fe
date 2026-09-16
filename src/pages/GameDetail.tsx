import { Suspense, useEffect, useState } from 'react'
/* eslint-disable react-hooks/static-components -- 动态获取懒加载游戏组件是预期模式 */
import { useParams, Link } from 'react-router-dom'
import { getGame } from '@/api'
import { ArrowLeft } from '@phosphor-icons/react'
import { getGameComponent } from '@/games/registry'
import { useUserStore } from '@/store/userStore'
import type { Game } from '@/types'

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

  if (loading)
    return (
      <main className="game-placeholder" role="status">
        正在准备游戏…
      </main>
    )

  if (error || !game || !id) {
    return (
      <main className="game-placeholder">
        <h1>{error || '游戏不存在'}</h1>
        <Link to="/" className="game-back" aria-label="返回游戏库">
          返回游戏库
        </Link>
      </main>
    )
  }

  const GameComponent = getGameComponent(id)
  return (
    <main className={`game-page game-page--${id}`}>
      <header className="game-page-toolbar">
        <Link to="/" className="game-back" aria-label="返回游戏库">
          <ArrowLeft size={20} aria-hidden="true" />
          <span>返回</span>
        </Link>
        <h1>{game.name.split(' · ')[0]}</h1>
        {game.name.includes(' · ') && (
          <span className="game-page-subtitle">{game.name.split(' · ').slice(1).join(' · ')}</span>
        )}
      </header>
      <div className="game-stage">
        {GameComponent ? (
          <Suspense
            fallback={
              <div className="game-placeholder" role="status">
                正在准备游戏…
              </div>
            }
          >
            <GameComponent userId={currentUser?.id} gameId={id} />
          </Suspense>
        ) : (
          <div className="game-placeholder">游戏即将开放</div>
        )}
      </div>
    </main>
  )
}
