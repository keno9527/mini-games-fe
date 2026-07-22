import type { ComponentType } from 'react'
import Breakout from '../../games/Breakout'
import Game2048 from '../../games/Game2048'
import Gomoku from '../../games/Gomoku'
import MemoryCard from '../../games/MemoryCard'
import Minesweeper from '../../games/Minesweeper'
import ReactionTest from '../../games/ReactionTest'
import SlidePuzzle from '../../games/SlidePuzzle'
import Snake from '../../games/Snake'
import Tetris from '../../games/Tetris'
import TicTacToe from '../../games/TicTacToe'
import TwentyFourPoints from '../../games/TwentyFourPoints'
import WhackAMole from '../../games/WhackAMole'
import Wordle from '../../games/Wordle'
import { getCatalogGame } from './data'

export interface GameComponentProps {
  userId?: string
  gameId: string
}

export interface GamePresentation {
  coverGradient: string
  icon: string
}

const fallbackPresentation: GamePresentation = {
  coverGradient: 'from-crt-purple to-crt-pink',
  icon: '🎮',
}

const gamePresentations: Record<string, GamePresentation> = {
  'starlight-catcher': {
    coverGradient: 'from-[#18225f] via-[#6d4df6] to-[#ffd66b]',
    icon: '✦',
  },
  minesweeper: {
    coverGradient: 'from-[#c6f4ff] via-[#88d96f] to-[#63b7ff]',
    icon: '💣',
  },
  snake: {
    coverGradient: 'from-[#9bf171] via-[#5cd45a] to-[#38bdf8]',
    icon: '🐍',
  },
  '24points': {
    coverGradient: 'from-[#8bc8ff] via-[#4f7ce8] to-[#b27cff]',
    icon: '🃏',
  },
  '2048': {
    coverGradient: 'from-[#ffe19b] via-[#ff944d] to-[#ff5f57]',
    icon: '🔢',
  },
  memory: {
    coverGradient: 'from-[#57b8ff] via-[#786dff] to-[#b66dff]',
    icon: '🎴',
  },
  'whack-a-mole': {
    coverGradient: 'from-[#a9ef73] via-[#5eca51] to-[#ffd45a]',
    icon: '🐹',
  },
  'slide-puzzle': {
    coverGradient: 'from-[#83d4ff] via-[#54b7f2] to-[#6be57d]',
    icon: '🧩',
  },
  'reaction-test': {
    coverGradient: 'from-[#ffe56b] via-[#ffb84d] to-[#ff6a63]',
    icon: '⚡',
  },
  'tic-tac-toe': {
    coverGradient: 'from-[#a6dcff] via-[#6db9ff] to-[#ffe56b]',
    icon: '❌',
  },
  tetris: {
    coverGradient: 'from-[#576dff] via-[#7d42e8] to-[#ff5aa5]',
    icon: '🧱',
  },
  breakout: {
    coverGradient: 'from-[#4b84ff] via-[#ff5555] to-[#ffd35a]',
    icon: '🏓',
  },
  wordle: {
    coverGradient: 'from-[#89e66d] via-[#36c96d] to-[#38bdf8]',
    icon: '📝',
  },
  gomoku: {
    coverGradient: 'from-[#f5d59b] via-[#d2a96b] to-[#9f7848]',
    icon: '⚫',
  },
}

const gameComponents: Record<string, ComponentType<GameComponentProps>> = {
  minesweeper: Minesweeper,
  snake: Snake,
  '24points': TwentyFourPoints,
  '2048': Game2048,
  memory: MemoryCard,
  'whack-a-mole': WhackAMole,
  'slide-puzzle': SlidePuzzle,
  'reaction-test': ReactionTest,
  'tic-tac-toe': TicTacToe,
  tetris: Tetris,
  breakout: Breakout,
  wordle: Wordle,
  gomoku: Gomoku,
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
  return gamePresentations[gameId] ?? fallbackPresentation
}

export function getGameComponent(gameId?: string) {
  return gameId ? gameComponents[gameId] : undefined
}

export function getGameTarget(gameId: string) {
  const game = getCatalogGame(gameId)
  return game?.externalUrl
    ? { href: game.externalUrl, isExternal: true }
    : { href: `/game/${gameId}`, isExternal: false }
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
  return resultBadgeMeta[result] ?? {
    label: result,
    className: 'text-crt-text-dim border-crt-border',
  }
}
