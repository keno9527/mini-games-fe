import { getGameManifest } from '@/games/registry'
import type { GamePresentation } from '@/games/manifest'
import { getCatalogGame } from '@/features/games/data'

export type { GamePresentation } from '@/games/manifest'

const fallbackPresentation: GamePresentation = {
  coverGradient: 'from-crt-purple to-crt-pink',
  icon: '🎮',
}

const difficultyChipClasses: Record<string, string> = {
  简单: 'bg-transparent text-crt-green border-crt-green',
  中等: 'bg-transparent text-crt-yellow border-crt-yellow',
  复杂: 'bg-transparent text-crt-pink border-crt-pink',
}

const resultBadgeMeta: Record<string, { label: string; className: string }> = {
  win: {
    label: 'WIN',
    className: 'text-crt-green border-crt-green',
  },
  lose: {
    label: 'LOSE',
    className: 'text-crt-pink border-crt-pink',
  },
  complete: {
    label: 'COMPLETE',
    className: 'text-crt-cyan border-crt-cyan',
  },
}

export function getGamePresentation(gameId: string): GamePresentation {
  return getGameManifest(gameId)?.presentation ?? fallbackPresentation
}

export function getGameRecordTitle(gameId: string, fallbackName?: string): string {
  const presentation = getGamePresentation(gameId)
  const label = fallbackName || getCatalogGame(gameId)?.name || gameId
  return `${presentation.icon} ${label}`
}

export function getDifficultyChipClass(difficulty: string): string {
  return difficultyChipClasses[difficulty] ?? 'bg-transparent text-crt-text-dim border-crt-border'
}

export function getResultBadgeMeta(result: string) {
  return (
    resultBadgeMeta[result] ?? {
      label: result,
      className: 'text-crt-text-dim border-crt-border',
    }
  )
}
