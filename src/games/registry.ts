import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import twentyFourPoints from '@/games/24points/manifest.ts'
import breakout from '@/games/breakout/manifest.ts'
import gomoku from '@/games/gomoku/manifest.ts'
import gravityGraveyard from '@/games/gravity-graveyard/manifest.ts'
import memory from '@/games/memory/manifest.ts'
import minesweeper from '@/games/minesweeper/manifest.ts'
import reactionTest from '@/games/reaction-test/manifest.ts'
import slidePuzzle from '@/games/slide-puzzle/manifest.ts'
import snake from '@/games/snake/manifest.ts'
import tankBattle from '@/games/tank-battle/manifest.ts'
import tetris from '@/games/tetris/manifest.ts'
import ticTacToe from '@/games/tic-tac-toe/manifest.ts'
import towerDefense from '@/games/tower-defense/manifest.ts'
import whackAMole from '@/games/whack-a-mole/manifest.ts'
import wordle from '@/games/wordle/manifest.ts'
import type { GameComponentProps, GameManifest, GamePresentation } from '@/games/manifest.ts'
import type { Game } from '@/types'

const gameManifests: readonly GameManifest[] = [
  tankBattle,
  towerDefense,
  gravityGraveyard,
  minesweeper,
  snake,
  twentyFourPoints,
  memory,
  whackAMole,
  slidePuzzle,
  reactionTest,
  ticTacToe,
  tetris,
  breakout,
  wordle,
  gomoku,
]

const manifestsById = new Map(gameManifests.map((manifest) => [manifest.game.id, manifest]))

const gameComponents = new Map<string, LazyExoticComponent<ComponentType<GameComponentProps>>>(
  gameManifests.map((manifest) => [manifest.game.id, lazy(manifest.load)]),
)

export const registeredGameCatalog: readonly Game[] = gameManifests.map((manifest) => manifest.game)

export function getRegisteredGame(gameId: string): Game | undefined {
  return manifestsById.get(gameId)?.game
}

export function getRegisteredGamePresentation(gameId: string): GamePresentation | undefined {
  return manifestsById.get(gameId)?.presentation
}

export function getGameComponent(
  gameId?: string,
): LazyExoticComponent<ComponentType<GameComponentProps>> | undefined {
  return gameId ? gameComponents.get(gameId) : undefined
}
