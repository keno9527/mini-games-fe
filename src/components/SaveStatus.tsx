import { useEffect, useSyncExternalStore } from 'react'
import { getSaveState, retrySaves, subscribeSaves } from '@/api/playerFiles'

export default function SaveStatus() {
  const state = useSyncExternalStore(subscribeSaves, getSaveState)
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (getSaveState().pending) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  if (!state.pending) return null
  return (
    <div
      className={`player-save-status${state.error ? ' is-error' : ''}`}
      role={state.error ? 'alert' : 'status'}
    >
      {state.saving ? (
        '正在保存结算记录…'
      ) : (
        <>
          <span>
            {state.error || '有未完成的文件保存'} · {state.pending} 条记录待保存，请重试后再离开。
          </span>
          <button type="button" onClick={() => void retrySaves().catch(() => {})}>
            重试保存
          </button>
        </>
      )}
    </div>
  )
}
