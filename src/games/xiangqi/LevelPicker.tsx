import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, CheckCircle, LockKey, Star, X } from '@phosphor-icons/react'
import { chapters, levels, LEVELS_PER_CHAPTER } from './levels'
import { unlockedLevel, type Progress } from './progression'

const number = (value: number) => String(value).padStart(2, '0')
const ornaments = ['车', '马', '炮', '兵', '将']

interface LevelPickerProps {
  current: number
  progress: Progress
  onStart: (index: number) => void
  onClose: () => void
}

export default function LevelPicker({ current, progress, onStart, onClose }: LevelPickerProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const initialSelection = useRef<HTMLButtonElement>(null)
  const [chapterIndex, setChapterIndex] = useState(Math.floor(current / LEVELS_PER_CHAPTER))
  const [selected, setSelected] = useState(current)
  const unlocked = unlockedLevel(progress)
  const availableChapters = chapters.slice(0, Math.ceil(levels.length / LEVELS_PER_CHAPTER))
  const chapter = availableChapters[chapterIndex]
  const start = chapterIndex * LEVELS_PER_CHAPTER
  const chapterLevels = levels.slice(start, start + LEVELS_PER_CHAPTER)
  const completed = levels.filter((level) => progress[level.id]).length
  const stars = levels.reduce((sum, level) => sum + (progress[level.id] ?? 0), 0)
  const chapterCompleted = chapterLevels.filter((level) => progress[level.id]).length
  const selectedLevel = levels[selected]

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    initialSelection.current?.focus()
    return () => element.close()
  }, [])

  function chooseChapter(index: number) {
    setChapterIndex(index)
    const first = index * LEVELS_PER_CHAPTER
    setSelected(Math.min(unlocked, first + LEVELS_PER_CHAPTER - 1, levels.length - 1))
  }

  function closePicker() {
    dialog.current?.close()
    onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="xq-picker-dialog"
      aria-labelledby="xq-picker-title"
      onCancel={(event) => {
        event.preventDefault()
        closePicker()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            closePicker()
        }
      }}
    >
      <header className="xq-picker-header">
        <div className="xq-picker-title">
          <h2 id="xq-picker-title">选择关卡</h2>
          <span>
            {availableChapters.length} 章 · {levels.length} 关
          </span>
        </div>
        <div className="xq-picker-totals">
          <span>
            已通关 <strong>{completed}</strong> / {levels.length}
          </span>
          <span aria-label={`累计 ${stars} 星，共 ${levels.length * 3} 星`}>
            <Star weight="fill" aria-hidden="true" /> <strong>{stars}</strong> / {levels.length * 3}
          </span>
        </div>
        <button
          type="button"
          className="xq-picker-close"
          aria-label="关闭选关"
          onClick={closePicker}
        >
          <X size={26} />
        </button>
      </header>
      <div className="xq-picker-layout">
        <nav className="xq-chapters" aria-label="章节">
          <h3>章节</h3>
          <div className="xq-chapter-list">
            {availableChapters.map((item, index) => {
              const first = index * LEVELS_PER_CHAPTER
              const items = levels.slice(first, first + LEVELS_PER_CHAPTER)
              const done = items.filter((level) => progress[level.id]).length
              const locked = first > unlocked
              return (
                <button
                  key={item.name}
                  type="button"
                  className={`xq-chapter${chapterIndex === index ? ' is-current' : ''}`}
                  aria-current={chapterIndex === index ? 'true' : undefined}
                  aria-label={`第 ${index + 1} 章 ${item.name}${locked ? '，未解锁' : `，已通关 ${done} / ${items.length}`}`}
                  disabled={locked}
                  onClick={() => chooseChapter(index)}
                >
                  <span className="xq-chapter-number">{number(index + 1)}</span>
                  <span className="xq-chapter-copy">
                    <strong>{item.name}</strong>
                    <small>
                      {number(first + 1)}–{number(first + items.length)} 关
                    </small>
                  </span>
                  {locked ? (
                    <LockKey size={19} weight="fill" aria-hidden="true" />
                  ) : (
                    <small>
                      {done} / {items.length}
                    </small>
                  )}
                </button>
              )
            })}
          </div>
          <p>通关本章，解锁下一章。</p>
        </nav>
        <section className="xq-chapter-content" aria-labelledby="xq-chapter-title">
          <div className="xq-chapter-heading">
            <div>
              <span>第{['一', '二', '三', '四', '五', '六'][chapterIndex]}章</span>
              <h3 id="xq-chapter-title">{chapter.name}</h3>
              <p>{chapter.description}</p>
            </div>
            <div className="xq-chapter-progress">
              <span>
                {chapterCompleted} / {chapterLevels.length} 关
              </span>
              <progress
                value={chapterCompleted}
                max={chapterLevels.length}
                aria-label="本章通关进度"
              />
            </div>
          </div>
          <div className="xq-level-grid" role="group" aria-label="选择本章关卡">
            {chapterLevels.map((level, offset) => {
              const index = start + offset
              const locked = index > unlocked
              const earned = progress[level.id] ?? 0
              const active = selected === index
              return (
                <button
                  key={level.id}
                  ref={index === current ? initialSelection : undefined}
                  type="button"
                  className={`xq-level-card${active ? ' is-selected' : ''}${locked ? ' is-locked' : ''}`}
                  disabled={locked}
                  aria-pressed={active}
                  aria-label={`第 ${index + 1} 关 ${level.name}，${level.moves} 步内取胜，${locked ? '未解锁' : earned ? `已通关 ${earned} 星` : '可挑战'}`}
                  onClick={() => setSelected(index)}
                >
                  <span className="xq-card-number">{number(index + 1)}</span>
                  <span
                    className={`xq-card-piece xq-piece ${offset === 4 ? 'black' : 'red'}`}
                    aria-hidden="true"
                  >
                    {ornaments[offset]}
                  </span>
                  {active && (
                    <span className="xq-card-selection">
                      <Check size={13} weight="bold" aria-hidden="true" />
                    </span>
                  )}
                  <strong className="xq-card-name">{level.name}</strong>
                  <span className="xq-card-objective">{level.moves} 步内取胜</span>
                  <span className="xq-card-bottom">
                    {earned ? (
                      <>
                        <span className="xq-card-complete">
                          <CheckCircle size={20} weight="fill" aria-hidden="true" /> 已通关
                        </span>
                        <span className="xq-card-stars" aria-hidden="true">
                          {[1, 2, 3].map((star) => (
                            <Star
                              key={star}
                              size={20}
                              weight="fill"
                              className={star <= earned ? 'is-earned' : ''}
                            />
                          ))}
                        </span>
                      </>
                    ) : (
                      <>
                        {offset === LEVELS_PER_CHAPTER - 1 && (
                          <span className="xq-card-badge">综合挑战</span>
                        )}
                        {locked ? (
                          <span className="xq-card-locked">
                            <LockKey size={17} weight="fill" aria-hidden="true" /> 未解锁
                          </span>
                        ) : (
                          <span className="xq-card-ready">可挑战</span>
                        )}
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          <footer className="xq-picker-footer">
            <div className="xq-picked-level">
              <strong>
                第 {number(selected + 1)} 关 · {selectedLevel.name}
              </strong>
              <span>红方先行 · {selectedLevel.moves} 步内取胜</span>
            </div>
            <p>已通关关卡可重玩，保留最佳星级。</p>
            <button
              type="button"
              className="xq-start-level"
              onClick={() => {
                dialog.current?.close()
                onStart(selected)
              }}
            >
              开始挑战 <ArrowRight size={24} aria-hidden="true" />
            </button>
          </footer>
        </section>
      </div>
    </dialog>
  )
}
