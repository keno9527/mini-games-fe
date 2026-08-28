import { registeredGameCatalog } from '@/games/registry.ts'
import type { Game, PlayRankItem } from '@/types'

export const gameCatalog: Game[] = [...registeredGameCatalog]

export const defaultPlayRanking: PlayRankItem[] = [
  { gameId: 'gravity-graveyard', gameName: '引力墓场', playCount: 1562 },
  { gameId: 'snake', gameName: '贪吃蛇', playCount: 1268 },
  { gameId: 'minesweeper', gameName: '扫雷', playCount: 986 },
  { gameId: 'tetris', gameName: '俄罗斯方块', playCount: 872 },
  { gameId: 'memory', gameName: '记忆翻牌', playCount: 765 },
]

export function getCatalogGame(id: string): Game | undefined {
  return gameCatalog.find((game) => game.id === id)
}
