import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import twentyFourPoints from './24points/manifest.ts'
import breakout from './breakout/manifest.ts'
import gomoku from './gomoku/manifest.ts'
import gravityGraveyard from './gravity-graveyard/manifest.ts'
import memory from './memory/manifest.ts'
import minesweeper from './minesweeper/manifest.ts'
import reactionTest from './reaction-test/manifest.ts'
import slidePuzzle from './slide-puzzle/manifest.ts'
import snake from './snake/manifest.ts'
import tankBattle from './tank-battle/manifest.ts'
import tetris from './tetris/manifest.ts'
import ticTacToe from './tic-tac-toe/manifest.ts'
import towerDefense from './tower-defense/manifest.ts'
import whackAMole from './whack-a-mole/manifest.ts'
import wordle from './wordle/manifest.ts'
import type {
  GameComponentProps,
  GameManifest,
  GamePresentation,
} from './manifest.ts'
import type { Game } from '../types'

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

const manifestsById = new Map(
  gameManifests.map(manifest => [manifest.game.id, manifest]),
)

const gameComponents = new Map<string, LazyExoticComponent<ComponentType<GameComponentProps>>>(
  gameManifests.map(manifest => [manifest.game.id, lazy(manifest.load)]),
)

export const registeredGameCatalog: readonly Game[] = gameManifests.map(
  manifest => manifest.game,
)

export function getRegisteredGame(gameId: string): Game | undefined {
  return manifestsById.get(gameId)?.game
}

export function getRegisteredGamePresentation(
  gameId: string,
): GamePresentation | undefined {
  return manifestsById.get(gameId)?.presentation
}

export function getGameComponent(
  gameId?: string,
): LazyExoticComponent<ComponentType<GameComponentProps>> | undefined {
  return gameId ? gameComponents.get(gameId) : undefined
}
