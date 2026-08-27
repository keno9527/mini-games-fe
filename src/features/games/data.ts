import { registeredGameCatalog } from '@/games/registry.ts'
import type { Game, PlayRankItem } from '@/types'

const externalGames: Game[] = [
  {
    id: 'starlight-catcher',
    name: '星光收集局',
    description: '移动星环、接住星光、避开陨石，在 40 秒里完成一场轻快治愈的街机挑战。',
    tags: ['治愈', '街机', '反应', '外部游戏'],
    difficulties: ['简单'],
    externalUrl: 'https://starlight-catcher-20260721.dalio-liu.chatgpt.site',
    externalLabel: '去收集星光',
  },
]

export const gameCatalog: Game[] = [...registeredGameCatalog, ...externalGames]

export const defaultPlayRanking: PlayRankItem[] = [
  { gameId: 'gravity-graveyard', gameName: '引力墓场', playCount: 1562 },
  { gameId: 'starlight-catcher', gameName: '星光收集局', playCount: 1396 },
  { gameId: 'snake', gameName: '贪吃蛇', playCount: 1268 },
  { gameId: 'minesweeper', gameName: '扫雷', playCount: 986 },
  { gameId: 'tetris', gameName: '俄罗斯方块', playCount: 872 },
  { gameId: 'memory', gameName: '记忆翻牌', playCount: 765 },
]

export function getCatalogGame(id: string): Game | undefined {
  return gameCatalog.find((game) => game.id === id)
}
