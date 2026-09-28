import { create } from 'zustand'
import { loadPlayerFile } from '@/api/playerFiles'
import type { User } from '@/types'

interface UserStore {
  currentUser: User | null
  restoreStatus: 'idle' | 'loading' | 'ready'
  restoreError: string
  restoreLastPlayer: () => Promise<void>
  setCurrentUser: (user: User | null) => void
}

export const useUserStore = create<UserStore>()((set, get) => ({
  currentUser: null,
  restoreStatus: 'idle',
  restoreError: '',
  restoreLastPlayer: async () => {
    if (get().restoreStatus !== 'idle') return
    set({ restoreStatus: 'loading' })
    try {
      let id: string | null = null
      try {
        id = localStorage.getItem('mini-games-last-player')
      } catch {
        // Player selection still works when browser storage is unavailable.
      }
      const file = id ? await loadPlayerFile(id) : null
      if (get().restoreStatus === 'loading') set({ currentUser: file?.player ?? null })
    } catch (error) {
      if (get().restoreStatus === 'loading')
        set({
          restoreError: error instanceof Error ? error.message : '上次玩家存档加载失败，请重新选择',
        })
    } finally {
      if (get().restoreStatus === 'loading') set({ restoreStatus: 'ready' })
    }
  },
  setCurrentUser: (user) => {
    if (user) {
      try {
        localStorage.setItem('mini-games-last-player', user.id)
      } catch {
        /* Optional preference. */
      }
    }
    set({ currentUser: user, restoreStatus: 'ready', restoreError: '' })
  },
}))
