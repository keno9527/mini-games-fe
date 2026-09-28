import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { BRICK_COLORS, LEVEL_LAYOUTS } from './levels'
import {
  BRUSHES,
  EDITOR_COLS,
  EDITOR_ROWS,
  breakableCount,
  createLevel,
  editorError,
  loadLevel,
  paintLine,
  playableLevel,
  saveLevel,
  type Brush,
  type Cell,
  type CustomLevel,
} from './editor'
import './editor.css'

interface Props {
  active: boolean
  onBack: () => void
  onPlay: (level: CustomLevel) => void
}

export default function LevelEditor({ active, onBack, onPlay }: Props) {
  const [initial] = useState(() => {
    try {
      return { saved: loadLevel(), error: '' }
    } catch (error) {
      return { saved: null, error: editorError(error) }
    }
  })
  const [draft, setDraft] = useState(() => initial.saved ?? createLevel(0))
  const [saved, setSaved] = useState(initial.saved)
  const [brush, setBrush] = useState<Brush>('1')
  const [past, setPast] = useState<string[][]>([])
  const [future, setFuture] = useState<string[][]>([])
  const [error, setError] = useState(initial.error)
  const [notice, setNotice] = useState('')
  const [template, setTemplate] = useState(0)
  const [cursor, setCursor] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  const strokeRef = useRef<{ before: string[]; last: Cell; pointerId: number } | null>(null)
  draftRef.current = draft
  const changed = JSON.stringify(draft) !== JSON.stringify(saved ?? createLevel(0))
  const count = breakableCount(draft.layout)

  useEffect(() => {
    if (!changed) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [changed])

  const updateLayout = (layout: string[]) => {
    const next = { ...draftRef.current, layout }
    draftRef.current = next
    setDraft(next)
    setNotice('')
    setError('')
  }
  const remember = (layout: string[]) => {
    setPast((items) => [...items.slice(-49), layout])
    setFuture([])
  }
  const replaceLayout = (layout: string[]) => {
    if (layout.join('') === draftRef.current.layout.join('')) return
    remember(draftRef.current.layout)
    updateLayout(layout)
  }
  const undo = () => {
    if (!past.length) return
    const current = draftRef.current.layout
    setFuture((items) => [...items, current])
    updateLayout(past[past.length - 1])
    setPast((items) => items.slice(0, -1))
  }
  const redo = () => {
    if (!future.length) return
    const current = draftRef.current.layout
    setPast((items) => [...items, current])
    updateLayout(future[future.length - 1])
    setFuture((items) => items.slice(0, -1))
  }
  const finishStroke = () => {
    const stroke = strokeRef.current
    strokeRef.current = null
    if (stroke && stroke.before.join('') !== draftRef.current.layout.join(''))
      remember(stroke.before)
  }
  const cellAt = (event: PointerEvent<HTMLDivElement>): Cell | null => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * EDITOR_COLS)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * EDITOR_ROWS)
    return x >= 0 && x < EDITOR_COLS && y >= 0 && y < EDITOR_ROWS ? [x, y] : null
  }
  const save = () => {
    try {
      const next = saveLevel(draftRef.current)
      setDraft(next)
      setSaved(next)
      setError('')
      setNotice('已保存到此浏览器，下次打开可继续编辑。')
    } catch (cause) {
      setNotice('')
      setError(editorError(cause))
    }
  }
  const play = () => {
    try {
      const next = playableLevel(draftRef.current)
      setError('')
      onPlay(next)
    } catch (cause) {
      setError(editorError(cause))
    }
  }

  return (
    <section
      className="game-surface breakout-room breakout-editor"
      onKeyDown={(event) => {
        if (!active || event.target instanceof HTMLInputElement || strokeRef.current) return
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
          event.preventDefault()
          if (event.shiftKey) redo()
          else undo()
        }
      }}
    >
      <header className="gs-heading">
        <div>
          <p className="gs-eyebrow">BRICK STUDIO · 关卡工坊</p>
          <h2>下一面砖墙，由你设计</h2>
        </div>
        <button
          className="gs-secondary"
          onClick={() => {
            if (!changed || window.confirm('还有未保存的修改，确定离开编辑器？')) onBack()
          }}
        >
          返回游戏
        </button>
      </header>

      <div className="breakout-editor-meta">
        <label htmlFor="breakout-level-name">
          关卡名称
          <input
            id="breakout-level-name"
            value={draft.name}
            maxLength={40}
            onChange={(event) => {
              setDraft({ ...draft, name: event.target.value })
              setNotice('')
              setError('')
            }}
          />
        </label>
        <p className="gs-caption" role="status">
          {saved && !changed ? '已保存到本地' : '尚未保存'} · {count} 块可击碎砖块
        </p>
      </div>

      <div className="breakout-editor-layout">
        <div className="breakout-editor-workspace">
          <div className="breakout-editor-actions">
            <button className="gs-secondary" onClick={undo} disabled={!past.length}>
              撤销
            </button>
            <button className="gs-secondary" onClick={redo} disabled={!future.length}>
              重做
            </button>
            <button className="gs-secondary" onClick={() => replaceLayout(createLevel().layout)}>
              清空画板
            </button>
            <span className="gs-caption">12 列 × 10 行</span>
          </div>
          <div className="breakout-editor-stage">
            <div
              ref={boardRef}
              className="breakout-editor-grid"
              role="group"
              aria-label="砖块画板，12 列 10 行"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0 || strokeRef.current) return
                const cell = cellAt(event)
                if (!cell) return
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                const index = cell[1] * EDITOR_COLS + cell[0]
                setCursor(index)
                boardRef.current?.querySelectorAll('button')[index]?.focus({ preventScroll: true })
                strokeRef.current = {
                  before: draftRef.current.layout,
                  last: cell,
                  pointerId: event.pointerId,
                }
                updateLayout(paintLine(draftRef.current.layout, cell, cell, brush))
              }}
              onPointerMove={(event) => {
                const stroke = strokeRef.current
                if (!stroke || stroke.pointerId !== event.pointerId) return
                const cell = cellAt(event)
                if (!cell) return
                updateLayout(paintLine(draftRef.current.layout, stroke.last, cell, brush))
                stroke.last = cell
                setCursor(cell[1] * EDITOR_COLS + cell[0])
              }}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              onLostPointerCapture={finishStroke}
            >
              {draft.layout.flatMap((row, y) =>
                [...row].map((tile, x) => {
                  const meta = BRUSHES.find((item) => item.tile === tile) ?? BRUSHES[0]
                  const index = y * EDITOR_COLS + x
                  return (
                    <button
                      key={index}
                      className={`breakout-editor-cell tile-${meta.tile === '#' ? 'steel' : meta.tile === '.' ? 'empty' : meta.tile}`}
                      style={
                        { '--brick-color': BRICK_COLORS[y % BRICK_COLORS.length] } as CSSProperties
                      }
                      aria-label={`第 ${y + 1} 行，第 ${x + 1} 列，${tile === '.' ? '空位' : meta.label}`}
                      tabIndex={index === cursor ? 0 : -1}
                      onFocus={() => setCursor(index)}
                      onClick={(event) => {
                        if (event.detail === 0)
                          replaceLayout(paintLine(draftRef.current.layout, [x, y], [x, y], brush))
                      }}
                      onKeyDown={(event) => {
                        const offsets: Record<string, Cell> = {
                          ArrowLeft: [-1, 0],
                          ArrowRight: [1, 0],
                          ArrowUp: [0, -1],
                          ArrowDown: [0, 1],
                        }
                        const offset = offsets[event.key]
                        if (!offset) return
                        event.preventDefault()
                        const nx = Math.max(0, Math.min(EDITOR_COLS - 1, x + offset[0]))
                        const ny = Math.max(0, Math.min(EDITOR_ROWS - 1, y + offset[1]))
                        boardRef.current?.querySelectorAll('button')[ny * EDITOR_COLS + nx]?.focus()
                      }}
                    >
                      <span aria-hidden="true">{tile === '.' ? '' : meta.symbol}</span>
                    </button>
                  )
                }),
              )}
            </div>
            <div className="breakout-editor-flight" aria-hidden="true">
              <span>留给反弹的空间</span>
              <i />
              <b />
            </div>
          </div>
          <p className="breakout-editor-help">
            点击或拖动绘制 · 方向键选格，空格放置 · ⌘ / Ctrl + Z 撤销
          </p>
        </div>

        <aside className="breakout-editor-palette" aria-label="砖块工具">
          <h3>选择砖块</h3>
          {BRUSHES.map((item) => (
            <button
              key={item.tile}
              className="breakout-editor-brush"
              aria-pressed={brush === item.tile}
              onClick={() => setBrush(item.tile)}
            >
              <span
                className={`breakout-editor-swatch swatch-${item.tile === '#' ? 'steel' : item.tile === '.' ? 'empty' : item.tile}`}
                aria-hidden="true"
              >
                {item.symbol}
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
          <div className="breakout-editor-template">
            <label htmlFor="breakout-template">从经典关卡开始</label>
            <select
              id="breakout-template"
              value={template}
              onChange={(event) => setTemplate(Number(event.target.value))}
            >
              {LEVEL_LAYOUTS.map((_, index) => (
                <option key={index} value={index}>
                  经典第 {index + 1} 关
                </option>
              ))}
            </select>
            <button
              className="gs-secondary"
              onClick={() => replaceLayout(createLevel(template).layout)}
            >
              载入模板
            </button>
            <small>替换画板后可以撤销。</small>
          </div>
        </aside>
      </div>

      <footer className="breakout-editor-footer">
        <p>保存在当前浏览器 · 试玩不会影响原稿或排行榜</p>
        <div className="breakout-editor-actions">
          <button className="gs-secondary" onClick={save}>
            保存关卡
          </button>
          <button className="gs-primary" onClick={play}>
            试玩关卡 ↗
          </button>
        </div>
      </footer>
      {draft.layout.some((row) => row.includes('#')) && (
        <p className="breakout-editor-help">
          钢砖无法击碎，请留出进球通道，并通过试玩检查砖块是否都能到达。
        </p>
      )}
      {notice && (
        <p className="breakout-editor-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="breakout-editor-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
