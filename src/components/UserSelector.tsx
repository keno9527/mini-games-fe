import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { getUsers, createUser, deleteUser } from '@/api'
import { loadPlayerFile } from '@/api/playerFiles'
import {
  hasGuestProgress,
  importGuestProgress,
  importLegacyPlayer,
  legacyUsers,
} from '@/features/players/migration'
import { useUserStore } from '@/store/userStore'
import type { User } from '@/types'

export default function UserSelector() {
  const { currentUser, setCurrentUser } = useUserStore()
  const [users, setUsers] = useState<User[]>([])
  const [oldUsers, setOldUsers] = useState<User[]>([])
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [guestAvailable, setGuestAvailable] = useState(false)
  const [claimGuest, setClaimGuest] = useState(false)
  const [lastPlayer] = useState(() => {
    try {
      return localStorage.getItem('mini-games-last-player')
    } catch {
      return null
    }
  })
  const report = (error: unknown) =>
    setError(error instanceof Error ? error.message : '操作失败，请重试')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await getUsers())
      setOldUsers(
        legacyUsers().filter((user) => !localStorage.getItem(`mini-games-imported:${user.id}`)),
      )
      setGuestAvailable(hasGuestProgress())
    } catch (error) {
      report(error)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const select = async (user: User) => {
    setBusy(true)
    setError('')
    try {
      if (claimGuest) await importGuestProgress(user)
      const file = await loadPlayerFile(user.id)
      setCurrentUser(file.player)
      setClaimGuest(false)
      setGuestAvailable(hasGuestProgress())
    } catch (error) {
      report(error)
    } finally {
      setBusy(false)
    }
  }
  const create = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !newName.trim()) return
    setBusy(true)
    setError('')
    try {
      const user = await createUser(newName)
      setUsers((previous) => [...previous, user])
      setNewName('')
      await select(user)
    } catch (error) {
      report(error)
    } finally {
      setBusy(false)
    }
  }
  const migrate = async () => {
    setBusy(true)
    setError('')
    try {
      for (const user of oldUsers) {
        await importLegacyPlayer(user)
        try {
          localStorage.setItem(`mini-games-imported:${user.id}`, '1')
        } catch {
          /* Server also deduplicates imports. */
        }
      }
      await load()
    } catch (error) {
      report(error)
      setUsers(await getUsers().catch(() => users))
    } finally {
      setBusy(false)
    }
  }
  const archive = async (user: User) => {
    if (!window.confirm(`归档玩家「${user.name}」？存档文件和历史仍会保留。`)) return
    setBusy(true)
    try {
      await deleteUser(user.id)
      if (currentUser?.id === user.id) setCurrentUser(null)
      await load()
    } catch (error) {
      report(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="player-selector" aria-labelledby="player-select-title">
      <h2 id="player-select-title">选择玩家</h2>
      <p>用同一个玩家档案，继续你的关卡与游戏历史。</p>
      {loading ? (
        <p role="status">正在读取玩家存档…</p>
      ) : (
        <>
          <ul className="player-list">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="player-choice"
                  aria-pressed={currentUser?.id === user.id}
                  disabled={busy}
                  onClick={() => void select(user)}
                >
                  <span className="player-avatar" aria-hidden="true">
                    {user.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{user.name}</strong>
                    <small>
                      {currentUser?.id === user.id
                        ? '当前玩家'
                        : lastPlayer === user.id
                          ? '上次使用'
                          : '继续游戏'}
                    </small>
                  </span>
                </button>
                {currentUser && (
                  <button
                    type="button"
                    className="player-archive"
                    disabled={busy}
                    onClick={() => void archive(user)}
                    aria-label={`归档玩家 ${user.name}`}
                  >
                    归档
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!users.length && !error && <p>还没有玩家，创建一个开始游戏吧。</p>}
        </>
      )}
      {oldUsers.length > 0 && (
        <button
          type="button"
          className="player-import"
          disabled={busy || loading}
          onClick={() => void migrate()}
        >
          导入旧浏览器存档（{oldUsers.length} 位玩家）
        </button>
      )}
      {guestAvailable && (
        <label className="player-guest">
          <input
            type="checkbox"
            checked={claimGuest}
            disabled={busy}
            onChange={(event) => setClaimGuest(event.target.checked)}
          />
          将旧游客及共用解锁进度归入本次选择的玩家
        </label>
      )}
      <form onSubmit={(event) => void create(event)} className="player-create">
        <label htmlFor="player-name">新玩家名称</label>
        <div>
          <input
            id="player-name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={20}
            disabled={busy || loading}
            placeholder="输入用户名"
            required
          />
          <button type="submit" disabled={busy || loading || !newName.trim()}>
            创建并进入
          </button>
        </div>
      </form>
      {busy && <p role="status">正在处理玩家存档…</p>}
      {error && (
        <div className="player-error" role="alert">
          <p>{error}</p>
          <button type="button" disabled={busy} onClick={() => void load()}>
            重新读取
          </button>
        </div>
      )}
    </section>
  )
}
