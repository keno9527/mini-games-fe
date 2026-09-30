import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import UserSelector from './UserSelector'

export default function PlayerGate({ children }: { children: ReactNode }) {
  const user = useUserStore((state) => state.currentUser)
  const { restoreStatus, restoreError, restoreLastPlayer } = useUserStore()
  useEffect(() => {
    void restoreLastPlayer()
  }, [restoreLastPlayer])
  if (restoreStatus !== 'ready')
    return (
      <main className="player-entry" role="status">
        正在加载玩家档案…
      </main>
    )
  if (user) return children
  return (
    <main className="player-entry">
      <h1>这一局，你是谁？</h1>
      <p>先选择玩家，结算后保存你的进度。</p>
      <Link to="/" className="game-back">
        游客游玩
      </Link>
      <p>无需创建玩家即可体验游戏，游客进度不保证在刷新后保留。</p>
      {restoreError && (
        <p role="alert" className="player-error">
          {restoreError}
        </p>
      )}
      <UserSelector />
    </main>
  )
}
