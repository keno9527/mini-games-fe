import * as React from 'react'
import { Link } from 'react-router-dom'
import { getGameManifest } from '@/games/registry'
import type { GameRuntime } from '@/games/manifest'

interface Props {
  gameId: string
  className?: string
  children: React.ReactNode
}

interface GameLaunchLinkViewProps extends Props {
  runtime?: GameRuntime
}

export function GameLaunchLinkView({
  gameId,
  className,
  children,
  runtime,
}: GameLaunchLinkViewProps) {
  if (runtime?.kind === 'external') {
    return (
      <a href={runtime.href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    )
  }

  if (!runtime) {
    return (
      <span className={className} aria-disabled="true">
        {children}
      </span>
    )
  }

  return (
    <Link to={`/game/${gameId}`} className={className}>
      {children}
    </Link>
  )
}

export default function GameLaunchLink({ gameId, className, children }: Props) {
  return (
    <GameLaunchLinkView
      gameId={gameId}
      className={className}
      runtime={getGameManifest(gameId)?.runtime}
    >
      {children}
    </GameLaunchLinkView>
  )
}
