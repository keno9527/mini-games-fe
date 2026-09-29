import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, CheckCircle, LockKey, X } from '@phosphor-icons/react'
import './level-picker.css'

export interface PickerLevel {
  /** The game's own callback ID; it need not match the displayed level number. */
  id: number
  name: string
  objective: string
  completed: boolean
  locked?: boolean
  result?: { label: string; content?: ReactNode }
  badge?: string
  preview?: ReactNode
  description?: string
}

export interface PickerChapter {
  name: string
  description: string
  levels: PickerLevel[]
  locked?: boolean
  /** Preferred selection when entering this chapter, subject to its unlock state. */
  defaultLevelId?: number
}

interface Props {
  current: number
  chapters: PickerChapter[]
  scoreSummary?: ReactNode
  chapterNote: string
  replayNote: string
  children?: ReactNode
  onStart: (id: number) => void
  onClose: () => void
}

const number = (value: number) => String(value).padStart(2, '0')

/** Mount while picking; tentative selection never changes the running game. */
export default function GameLevelPicker({
  current,
  chapters,
  scoreSummary,
  chapterNote,
  replayNote,
  children,
  onStart,
  onClose,
}: Props) {
  const titleId = useId()
  const chapterTitleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const initialSelection = useRef<HTMLButtonElement>(null)
  const [chapterIndex, setChapterIndex] = useState(() =>
    Math.max(
      0,
      chapters.findIndex((chapter) => chapter.levels.some((level) => level.id === current)),
    ),
  )
  const [selected, setSelected] = useState(current)
  const chapter = chapters[chapterIndex]
  const levels = chapters.flatMap((item) => item.levels)
  const selectedIndex = levels.findIndex((level) => level.id === selected)
  const selectedLevel = levels[selectedIndex]
  const completed = levels.filter((level) => level.completed).length
  const chapterCompleted = chapter.levels.filter((level) => level.completed).length
  const canStart =
    !chapter.locked &&
    !!selectedLevel &&
    !selectedLevel.locked &&
    chapter.levels.some((level) => level.id === selected)

  useEffect(() => {
    const element = dialog.current!
    const trigger = document.activeElement
    element.showModal()
    initialSelection.current?.focus()
    return () => {
      element.close()
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true })
    }
  }, [])

  function close() {
    dialog.current?.close()
    onClose()
  }

  function chooseChapter(index: number) {
    const next = chapters[index]
    if (next.locked) return
    setChapterIndex(index)
    if (next.levels.some((level) => level.id === selected && !level.locked)) return
    const nextSelection =
      next.levels.find((level) => level.id === next.defaultLevelId && !level.locked) ??
      next.levels.find((level) => !level.locked)
    if (nextSelection) setSelected(nextSelection.id)
  }

  return (
    <dialog
      ref={dialog}
      className="game-level-picker game-panel game-controls"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          close()
      }}
    >
      <header className="level-picker-header">
        <div>
          <h2 id={titleId}>选择关卡</h2>
          <p>
            {chapters.length} 章 · {levels.length} 关
          </p>
        </div>
        <div className="level-picker-totals">
          <span>
            已通关 <strong>{completed}</strong> / {levels.length}
          </span>
          {scoreSummary}
        </div>
        <button data-game-control type="button" aria-label="关闭选关" onClick={close}>
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="level-picker-layout">
        <nav className="level-picker-chapters" aria-label="章节">
          {chapters.map((item, index) => {
            const done = item.levels.filter((level) => level.completed).length
            return (
              <button
                data-game-control
                key={item.name}
                type="button"
                disabled={item.locked}
                aria-current={chapterIndex === index ? 'true' : undefined}
                aria-label={`第 ${index + 1} 章 ${item.name}${item.locked ? '，未解锁' : `，已通关 ${done} / ${item.levels.length}`}`}
                onClick={() => chooseChapter(index)}
              >
                <span>{number(index + 1)}</span>
                <strong>{item.name}</strong>
                {item.locked ? (
                  <LockKey size={18} weight="fill" aria-hidden="true" />
                ) : (
                  <small>
                    {done} / {item.levels.length}
                  </small>
                )}
              </button>
            )
          })}
          <p>{chapterNote}</p>
        </nav>
        <section className="level-picker-content" aria-labelledby={chapterTitleId}>
          <div className="level-picker-scroll">
            <div className="level-picker-heading">
              <div>
                <h3 id={chapterTitleId}>{chapter.name}</h3>
                <p>{chapter.description}</p>
              </div>
              <div className="level-picker-progress">
                <span>
                  {chapterCompleted} / {chapter.levels.length} 通关
                </span>
                <progress
                  value={chapterCompleted}
                  max={chapter.levels.length}
                  aria-label="本章通关进度"
                />
              </div>
            </div>
            <div className="level-picker-levels" role="group" aria-label="选择本章关卡">
              {chapter.levels.map((level) => {
                const index = levels.findIndex((item) => item.id === level.id)
                const locked = chapter.locked || level.locked
                const status = locked
                  ? '未解锁'
                  : (level.result?.label ?? (level.completed ? '已通关' : '可挑战'))
                return (
                  <button
                    data-game-control
                    key={level.id}
                    ref={level.id === current ? initialSelection : undefined}
                    type="button"
                    disabled={locked}
                    aria-pressed={selected === level.id}
                    aria-label={`第 ${index + 1} 关 ${level.name}，${level.objective}，${status}`}
                    onClick={() => setSelected(level.id)}
                  >
                    <span className="level-picker-card-top">
                      {number(index + 1)}
                      {selected === level.id && (
                        <Check size={18} weight="bold" aria-hidden="true" />
                      )}
                    </span>
                    {level.preview}
                    <strong>{level.name}</strong>
                    <span>{level.objective}</span>
                    {level.badge && <span>{level.badge}</span>}
                    <span className="level-picker-card-status">
                      {locked ? (
                        <LockKey size={18} aria-hidden="true" />
                      ) : level.completed ? (
                        <CheckCircle size={18} weight="fill" aria-hidden="true" />
                      ) : null}
                      <span className="level-picker-result">
                        {locked ? status : (level.result?.content ?? status)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="level-picker-mobile-note">{chapterNote}</p>
            {children}
          </div>
          <footer className="level-picker-footer">
            <div>
              {selectedLevel && (
                <>
                  <strong>
                    第 {number(selectedIndex + 1)} 关 · {selectedLevel.name}
                  </strong>
                  <p>{selectedLevel.description ?? selectedLevel.objective}</p>
                </>
              )}
              <small>{replayNote}</small>
            </div>
            <button
              data-game-control
              type="button"
              className="game-primary"
              disabled={!canStart}
              onClick={() => {
                if (!canStart) return
                dialog.current?.close()
                onStart(selected)
              }}
            >
              开始挑战 <ArrowRight size={20} aria-hidden="true" />
            </button>
          </footer>
        </section>
      </div>
    </dialog>
  )
}
