import { registeredGameCatalog } from '@/games/registry.ts'
import type { Game } from '@/types'

export const gameCatalog: Game[] = [...registeredGameCatalog]

export function getCatalogGame(id: string): Game | undefined {
  return gameCatalog.find((game) => game.id === id)
}
