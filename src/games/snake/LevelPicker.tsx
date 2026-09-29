import GameLevelPicker, { type PickerChapter } from '@/components/GameLevelPicker'
import { Diamond } from '@phosphor-icons/react'
import { chapters, levels } from './levels'
import { positions } from './engine'
import { unlockedLevel, type Progress } from './progression'

interface Props {
  current: number
  progress: Progress
  onStart: (index: number) => void
  onClose: () => void
}

const levelsPerChapter = 3

export default function LevelPicker({ current, progress, onStart, onClose }: Props) {
  const unlocked = unlockedLevel(progress)
  const gems = levels.filter((level) => progress[level.id]?.medal === 2).length
  const pickerChapters: PickerChapter[] = chapters.map((name, chapter) => {
    const first = chapter * levelsPerChapter
    return {
      name,
      description: '通关即可解锁下一关，宝石是可选挑战。',
      locked: first > unlocked,
      defaultLevelId: Math.min(unlocked, first + levelsPerChapter - 1),
      levels: levels.slice(first, first + levelsPerChapter).map((level, offset) => {
        const result = progress[level.id]
        const index = first + offset
        return {
          id: index,
          name: level.name,
          objective: `吃齐 ${positions(level, 'o').length} 个苹果`,
          description: level.hint,
          completed: !!result,
          locked: index > unlocked,
          result: result
            ? {
                label: `已通关 · ${result.bestMoves} 步${result.medal === 2 ? '，宝石已收集' : ''}`,
                content: (
                  <>
                    <span>已通关 · {result.bestMoves} 步</span>
                    {result.medal === 2 && <span>◆ 宝石已收集</span>}
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
        <span>
          <Diamond weight="fill" aria-hidden="true" /> 宝石 <strong>{gems}</strong> /{' '}
          {levels.length}
        </span>
      }
      chapterNote="通关本章，解锁下一章。"
      replayNote="重新挑战从本关起点开始，保留最佳成绩与已收集宝石。"
      onStart={onStart}
      onClose={onClose}
    />
  )
}
