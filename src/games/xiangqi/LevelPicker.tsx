import GameLevelPicker, { type PickerChapter } from '@/components/GameLevelPicker'
import { Star } from '@phosphor-icons/react'
import { chapters, levels, LEVELS_PER_CHAPTER } from './levels'
import { unlockedLevel, type Progress } from './progression'

interface Props {
  current: number
  progress: Progress
  onStart: (index: number) => void
  onClose: () => void
}

export default function LevelPicker({ current, progress, onStart, onClose }: Props) {
  const unlocked = unlockedLevel(progress)
  const stars = levels.reduce((sum, level) => sum + (progress[level.id] ?? 0), 0)
  const pickerChapters: PickerChapter[] = chapters
    .slice(0, Math.ceil(levels.length / LEVELS_PER_CHAPTER))
    .map((chapter, chapterIndex) => {
      const first = chapterIndex * LEVELS_PER_CHAPTER
      return {
        name: chapter.name,
        description: chapter.description,
        locked: first > unlocked,
        defaultLevelId: Math.min(unlocked, first + LEVELS_PER_CHAPTER - 1, levels.length - 1),
        levels: levels.slice(first, first + LEVELS_PER_CHAPTER).map((level, offset) => {
          const index = first + offset
          const earned = progress[level.id] ?? 0
          return {
            id: index,
            name: level.name,
            objective: `${level.moves} 步内取胜`,
            description: `红方先行 · ${level.moves} 步内取胜`,
            completed: earned > 0,
            locked: index > unlocked,
            badge: offset === LEVELS_PER_CHAPTER - 1 && !earned ? '综合挑战' : undefined,
            result: earned
              ? {
                  label: `已通关 ${earned} 星`,
                  content: (
                    <>
                      <span>已通关</span>
                      <span className="level-picker-rating" aria-hidden="true">
                        {[1, 2, 3].map((star) => (
                          <Star key={star} size={18} weight={star <= earned ? 'fill' : 'regular'} />
                        ))}
                      </span>
                    </>
                  ),
                }
              : undefined,
          }
        }),
      }
    })

  return (
    <GameLevelPicker
      current={current}
      chapters={pickerChapters}
      scoreSummary={
        <span aria-label={`累计 ${stars} 星，共 ${levels.length * 3} 星`}>
          <Star weight="fill" aria-hidden="true" /> <strong>{stars}</strong> / {levels.length * 3}
        </span>
      }
      chapterNote="通关本章，解锁下一章。"
      replayNote="已通关关卡可重玩，保留最佳星级。"
      onStart={onStart}
      onClose={onClose}
    />
  )
}
