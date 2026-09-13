const PROGRESSION_KEY = 'mini-games-local-progression'

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

export function getGameProgression(gameId: string): GameProgression {
  try {
    const raw = window.localStorage.getItem(`${PROGRESSION_KEY}:${gameId}`)
    if (!raw) return emptyProgression()
    const stored = JSON.parse(raw) as Partial<GameProgression>
    return {
      liturgies: uniqueStrings(stored.liturgies),
      tools: uniqueStrings(stored.tools),
      ships: uniqueStrings(stored.ships),
    }
  } catch {
    return emptyProgression()
  }
}

export function saveGameProgression(gameId: string, progression: GameProgression): void {
  const normalized: GameProgression = {
    liturgies: uniqueStrings(progression.liturgies),
    tools: uniqueStrings(progression.tools),
    ships: uniqueStrings(progression.ships),
  }
  window.localStorage.setItem(`${PROGRESSION_KEY}:${gameId}`, JSON.stringify(normalized))
}
