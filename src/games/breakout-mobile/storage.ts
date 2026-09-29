import { LEVEL_LAYOUTS } from '../breakout/levels'
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../breakout/audio'

export const MOBILE_SAVE_KEY = 'mini-games-breakout-mobile-v1'
export interface MobileSaveData {
  version: 1
  lastPlayedLevel: number
  bestScore: number
  audio: AudioSettings
}
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>

function initialSave(): MobileSaveData {
  return { version: 1, lastPlayedLevel: 1, bestScore: 0, audio: { ...DEFAULT_AUDIO_SETTINGS } }
}

function parseSave(raw: string): MobileSaveData {
  const value = JSON.parse(raw)
  if (
    value?.version !== 1 ||
    !Number.isInteger(value.lastPlayedLevel) ||
    value.lastPlayedLevel < 1 ||
    value.lastPlayedLevel > LEVEL_LAYOUTS.length ||
    !Number.isSafeInteger(value.bestScore) ||
    value.bestScore < 0 ||
    typeof value.audio?.enabled !== 'boolean' ||
    typeof value.audio.volume !== 'number' ||
    !Number.isFinite(value.audio.volume) ||
    value.audio.volume < 0 ||
    value.audio.volume > 1
  )
    throw new Error('Invalid mobile save')
  return {
    version: 1,
    lastPlayedLevel: value.lastPlayedLevel,
    bestScore: value.bestScore,
    audio: { enabled: value.audio.enabled, volume: value.audio.volume },
  }
}

/** A corrupt save stays untouched; unavailable storage never blocks the current game. */
export class MobileSave {
  data = initialSave()
  error = ''
  private storage?: StoragePort
  private corrupt = false

  constructor(getStorage: () => StoragePort = () => localStorage) {
    try {
      this.storage = getStorage()
      const raw = this.storage.getItem(MOBILE_SAVE_KEY)
      if (raw !== null) {
        try {
          this.data = parseSave(raw)
        } catch {
          this.corrupt = true
          this.error = '原存档无法读取，已保留。本次进度仅在当前页面有效。'
        }
      }
    } catch {
      this.error = '浏览器存储不可用，本次进度仅在当前页面有效。'
    }
  }

  update(change: Partial<Omit<MobileSaveData, 'version'>>) {
    this.data = {
      ...this.data,
      ...change,
      bestScore: Math.max(this.data.bestScore, change.bestScore ?? 0),
    }
    if (this.corrupt || !this.storage) return
    try {
      // Also protect a save that another tab has replaced with unreadable data.
      const raw = this.storage.getItem(MOBILE_SAVE_KEY)
      if (raw !== null) {
        let previous: MobileSaveData
        try {
          previous = parseSave(raw)
        } catch {
          this.corrupt = true
          this.error = '原存档无法读取，已保留。本次进度仅在当前页面有效。'
          return
        }
        this.data.bestScore = Math.max(this.data.bestScore, previous.bestScore)
      }
      this.storage.setItem(MOBILE_SAVE_KEY, JSON.stringify(this.data))
      this.error = ''
    } catch {
      this.error = '进度未能保存，本次游戏仍可继续。请检查浏览器存储空间。'
    }
  }
}
