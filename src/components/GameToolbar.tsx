import { createContext, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'

const ToolbarTarget = createContext<HTMLElement | null | undefined>(undefined)

/** Games retain their action state while rendering controls in the page header. */
export function GameToolbarProvider({ title, children }: { title: string; children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const [name, ...subtitle] = title.split(' · ')
  return (
    <ToolbarTarget value={target}>
      <header className="game-page-toolbar">
        <div className="game-page-heading">
          <Link to="/" className="game-back" aria-label="返回首页">
            <ArrowLeft size={20} aria-hidden="true" />
            <span>返回首页</span>
          </Link>
          <h1>{name}</h1>
          {subtitle.length > 0 && (
            <span className="game-page-subtitle">{subtitle.join(' · ')}</span>
          )}
        </div>
        <div ref={setTarget} className="game-toolbar-actions" aria-label="游戏操作" />
      </header>
      {children}
    </ToolbarTarget>
  )
}

export function GameToolbar({ children }: { children: ReactNode }) {
  const target = useContext(ToolbarTarget)
  if (target === null) return null
  const controls = <div className="game-action-group game-controls">{children}</div>
  return target ? createPortal(controls, target) : controls
}
