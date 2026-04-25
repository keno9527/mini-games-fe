import { useState, useEffect } from 'react'
import { getUsers, createUser, deleteUser } from '../api'
import { useUserStore } from '../store/userStore'
import type { User } from '../types'

const avatarGradients = [
  'from-fun-accent to-fun-yellow',
  'from-fun-purple to-fun-pink',
  'from-fun-sky to-fun-purple',
  'from-fun-green to-fun-sky',
  'from-fun-pink to-fun-accent',
  'from-fun-yellow to-fun-green',
]

export default function UserSelector() {
  const { currentUser, setCurrentUser } = useUserStore()
  const [users, setUsers] = useState<User[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    getUsers()
      .then(setUsers)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const user = await createUser(name)
      setUsers(prev => [...prev, user])
      setCurrentUser(user)
      setNewName('')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (user: User, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteUser(user.id)
    if (currentUser?.id === user.id) setCurrentUser(null)
    load()
  }

  return (
    <div className="bg-fun-card border-2 border-fun-border rounded-3xl p-6 shadow-card">
      <h2 className="text-xl font-black text-fun-text mb-4 flex items-center gap-2">
        👥 用户管理
      </h2>

      {loading ? (
        <p className="text-fun-muted text-sm font-semibold">加载中...</p>
      ) : (
        <div className="space-y-2 mb-5">
          {users.length === 0 && (
            <p className="text-fun-muted text-sm font-semibold text-center py-4">暂无用户，请先创建 🎈</p>
          )}
          {users.map((u, idx) => (
            <div
              key={u.id}
              onClick={() => setCurrentUser(u)}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all border-2 ${
                currentUser?.id === u.id
                  ? 'bg-fun-accent/10 border-fun-accent text-fun-text'
                  : 'border-fun-border hover:border-fun-accent/40 hover:bg-fun-accent/5 text-fun-text'
              }`}
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} flex items-center justify-center text-sm font-black text-white flex-shrink-0 shadow-btn`}>
                {u.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{u.name}</p>
                <p className="text-xs text-fun-muted font-medium">
                  {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {currentUser?.id === u.id && (
                <span className="text-xs font-black text-fun-accent bg-fun-accent/10 px-2 py-0.5 rounded-full">当前</span>
              )}
              <button
                onClick={(e) => handleDelete(u, e)}
                className="text-red-400 hover:text-white hover:bg-red-400 text-xs px-2 py-1 rounded-full transition-all font-bold"
                title="删除用户"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create new user */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="新用户名称 🌟"
          maxLength={20}
          className="flex-1 bg-fun-bg border-2 border-fun-border rounded-2xl px-4 py-2.5 text-sm text-fun-text placeholder-fun-muted focus:outline-none focus:border-fun-accent transition-colors font-semibold"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="px-5 py-2.5 rounded-full bg-fun-accent text-white text-sm font-black hover:-translate-y-0.5 shadow-btn hover:shadow-btn-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none transition-all"
        >
          {creating ? '...' : '添加'}
        </button>
      </div>
    </div>
  )
}
