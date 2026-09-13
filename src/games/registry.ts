import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import twentyFourPoints from '@/games/24points/manifest.ts'
import breakout from '@/games/breakout/manifest.ts'
import gomoku from '@/games/gomoku/manifest.ts'
import gravityGraveyard from '@/games/gravity-graveyard/manifest.ts'
import laserMirror from '@/games/laser-mirror/manifest.ts'
import memory from '@/games/memory/manifest.ts'
import minesweeper from '@/games/minesweeper/manifest.ts'
import snake from '@/games/snake/manifest.ts'
import tankBattle from '@/games/tank-battle/manifest.ts'
import tetris from '@/games/tetris/manifest.ts'
import whackAMole from '@/games/whack-a-mole/manifest.ts'
import xiangqi from '@/games/xiangqi/manifest.ts'
import type { GameComponentProps, GameManifest } from '@/games/manifest.ts'
import type { Game } from '@/types'

const gameManifests: readonly GameManifest[] = [
  xiangqi,
  tankBattle,
  gravityGraveyard,
  laserMirror,
  minesweeper,
  snake,
  twentyFourPoints,
  memory,
  whackAMole,
  tetris,
  breakout,
  gomoku,
]

const manifestsById = new Map(gameManifests.map((manifest) => [manifest.game.id, manifest]))

const gameComponents = new Map<string, LazyExoticComponent<ComponentType<GameComponentProps>>>()

gameManifests.forEach((manifest) => {
  if (manifest.runtime.kind === 'embedded') {
    gameComponents.set(manifest.game.id, lazy(manifest.runtime.load))
  }
})

export const registeredGameCatalog: readonly Game[] = gameManifests.map((manifest) => manifest.game)

export function getGameManifest(gameId: string): GameManifest | undefined {
  return manifestsById.get(gameId)
}

export function getGameComponent(
  gameId?: string,
): LazyExoticComponent<ComponentType<GameComponentProps>> | undefined {
  return gameId ? gameComponents.get(gameId) : undefined
}
