import { useState, useEffect } from 'react'
import { getUsers, createUser, deleteUser } from '../api'
import { useUserStore } from '../store/userStore'
import type { User } from '../types'

const avatarGradients = [
  'from-crt-pink to-crt-yellow',
  'from-crt-pink to-crt-purple',
  'from-crt-cyan to-crt-purple',
  'from-crt-green to-crt-cyan',
  'from-crt-pink to-crt-cyan',
  'from-crt-yellow to-crt-green',
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
    <div className="bg-crt-bg-card border-2 border-crt-cyan shadow-crt-card p-5">
      <h2 className="font-pixel text-[11px] text-crt-cyan mb-4 tracking-wider" style={{ textShadow: '0 0 6px #00f0ff' }}>
        &gt;&gt; PLAYER SELECT
      </h2>

      {loading ? (
        <p className="font-mono-crt text-[15px] text-crt-muted">&gt; LOADING...</p>
      ) : (
        <div className="space-y-2 mb-5">
          {users.length === 0 && (
            <p className="font-mono-crt text-[15px] text-crt-muted text-center py-4">
              &gt; NO PLAYER FOUND, CREATE ONE
            </p>
          )}
          {users.map((u, idx) => (
            <div
              key={u.id}
              onClick={() => setCurrentUser(u)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-2 ${
                currentUser?.id === u.id
                  ? 'bg-crt-pink/10 border-crt-pink shadow-neon-p'
                  : 'border-crt-border hover:border-crt-cyan'
              }`}
            >
              <div
                className={`w-10 h-10 bg-gradient-to-br ${avatarGradients[idx % avatarGradients.length]} flex items-center justify-center font-pixel text-[11px] text-white flex-shrink-0 border-2 border-crt-yellow`}
                style={{ imageRendering: 'pixelated' }}
              >
                {u.name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono-crt text-[15px] text-crt-text tracking-wider truncate">{u.name}</p>
                <p className="font-mono-crt text-[12px] text-crt-muted">
                  &gt; {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {currentUser?.id === u.id && (
                <span className="font-pixel text-[7px] text-crt-bg-deep bg-crt-pink px-1.5 py-0.5 tracking-wider">ACTIVE</span>
              )}
              <button
                onClick={(e) => handleDelete(u, e)}
                className="font-pixel text-[8px] text-crt-pink border border-crt-pink hover:bg-crt-pink hover:text-crt-bg-deep px-2 py-1 transition-colors"
                title="删除用户"
              >
                X
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
          placeholder="&gt; ENTER NAME..."
          maxLength={20}
          className="flex-1 bg-black border-2 border-crt-cyan px-3 py-2 font-mono-crt text-[15px] text-crt-green placeholder-crt-muted focus:outline-none focus:border-crt-yellow transition-colors"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="px-4 py-2 bg-crt-yellow text-crt-bg-deep font-pixel text-[9px] shadow-neon-y disabled:opacity-40 disabled:cursor-not-allowed transition-all tracking-wider"
        >
          {creating ? '...' : '+ ADD'}
        </button>
      </div>
    </div>
  )
}
