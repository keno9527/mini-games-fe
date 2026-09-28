import { useEffect, useMemo } from 'react'
import { GamePlayTracker, type PlayState } from '@/features/games/playStats'

/** Track lifecycle in memory; persistent totals now come from settled player records. */
export function useGamePlay(gameId: string, state?: PlayState) {
  const tracker = useMemo(
    () =>
      new GamePlayTracker(() => {
        void gameId
      }),
    [gameId],
  )

  useEffect(() => {
    const visibility = () => tracker.setVisible(!document.hidden)
    const hide = () => tracker.setVisible(false)
    visibility()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', visibility)
    return () => {
      tracker.stop()
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
