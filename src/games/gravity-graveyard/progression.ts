import { readPlayerProgress, stageProgress } from '../../api/playerFiles'

export interface GameProgression {
  liturgies: string[]
  tools: string[]
  ships: string[]
}

const emptyProgression = (): GameProgression => ({
  liturgies: [],
  tools: [],
  ships: [],
})

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item) => typeof item === 'string' && item.length > 0)))
}

export function getGameProgression(gameId: string, userId?: string): GameProgression {
  try {
    const stored = readPlayerProgress(gameId, userId) as Partial<GameProgression>
    return {
      liturgies: uniqueStrings(stored.liturgies),
      tools: uniqueStrings(stored.tools),
      ships: uniqueStrings(stored.ships),
    }
  } catch {
    return emptyProgression()
  }
}

export function saveGameProgression(
  gameId: string,
  progression: GameProgression,
  userId?: string,
): void {
  const normalized: GameProgression = {
    liturgies: uniqueStrings(progression.liturgies),
    tools: uniqueStrings(progression.tools),
    ships: uniqueStrings(progression.ships),
  }
  stageProgress(gameId, userId, { ...normalized })
}
