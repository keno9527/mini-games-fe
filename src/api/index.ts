import axios from 'axios'
import type { Game, User, GameRecord, UserStats, PlayRankItem } from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

function devLogLine(parts: unknown[]) {
  if (!import.meta.env.DEV) return
  const line = parts.map(p => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')
  void fetch('/__client-log', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: `[API] ${line}`,
  })
}

if (import.meta.env.DEV) {
  api.interceptors.request.use(config => {
    devLogLine([
      (config.method ?? 'get').toUpperCase(),
      config.url ?? '',
      config.data != null ? config.data : '',
    ])
    return config
  })
  api.interceptors.response.use(
    res => {
      devLogLine([String(res.status), (res.config.method ?? 'get').toUpperCase(), res.config.url ?? ''])
      return res
    },
    err => {
      const cfg = err.config
      devLogLine([
        'ERR',
        String(err.response?.status ?? ''),
        (cfg?.method ?? '?').toUpperCase(),
        cfg?.url ?? '',
        err.message,
      ])
      return Promise.reject(err)
    }
  )
}

// Games
export const getGames = (): Promise<Game[]> =>
  api.get('/games').then(r => r.data)

export const getGame = (id: string): Promise<Game> =>
  api.get(`/games/${id}`).then(r => r.data)

// Users
export const getUsers = (): Promise<User[]> =>
  api.get('/users').then(r => r.data)

export const createUser = (name: string, avatar?: string): Promise<User> =>
  api.post('/users', { name, avatar }).then(r => r.data)

export const deleteUser = (id: string): Promise<void> =>
  api.delete(`/users/${id}`)

export const getUserStats = (id: string): Promise<UserStats> =>
  api.get(`/users/${id}/stats`).then(r => r.data)

// Records
export const getRecords = (userId: string): Promise<GameRecord[]> =>
  api.get(`/users/${userId}/records`).then(r => r.data)

export const createRecord = (
  userId: string,
  data: { gameId: string; score: number; duration: number; result: string }
): Promise<GameRecord> =>
  api.post(`/users/${userId}/records`, data).then(r => r.data)

// Ranking
export const getPlayRanking = (): Promise<PlayRankItem[]> =>
  api.get('/records/ranking').then(r => r.data)
