import { useEffect, useMemo } from 'react'
import { addGamePlayStats } from '@/api'
import { GamePlayTracker, type PlayState } from '@/features/games/playStats'

/** Anonymous game totals, independent of the player's personal score records. */
export function useGamePlay(gameId: string, state?: PlayState) {
  const tracker = useMemo(
    () => new GamePlayTracker((delta) => addGamePlayStats(gameId, delta)),
    [gameId],
  )

  useEffect(() => {
    const visibility = () => tracker.setVisible(!document.hidden)
    const hide = () => tracker.setVisible(false)
    visibility()
    const timer = window.setInterval(tracker.flush, 10_000)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', visibility)
    return () => {
      tracker.stop()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', visibility)
    }
  }, [tracker])

  useEffect(() => {
    if (state !== undefined) tracker.setState(state)
  }, [tracker, state])

  return tracker
}
