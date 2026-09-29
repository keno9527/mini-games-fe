import GameLevelPicker, { type PickerChapter } from '@/components/GameLevelPicker'
import { LOGIC_LEVELS } from './levels'
import { CHAPTERS, LESSONS, chapterUnlocked, type LogicProgress } from './logic'

interface Props {
  current: number
  progress: LogicProgress
  onStart: (id: number) => void
  onClose: () => void
}

const levelsPerChapter = 5

export default function LevelPicker({ current, progress, onStart, onClose }: Props) {
  const unaided = LOGIC_LEVELS.filter((level) => progress[level.id]?.unaided).length
  const chapters: PickerChapter[] = CHAPTERS.map((name, index) => ({
    name,
    description: LESSONS[index],
    locked: !chapterUnlocked(index, progress),
    levels: LOGIC_LEVELS.slice(index * levelsPerChapter, (index + 1) * levelsPerChapter).map(
      (level, offset) => ({
        id: level.id,
        name: level.name,
        objective: `${level.rows} × ${level.cols} · ${level.mines.length} 雷`,
        completed: !!progress[level.id]?.completed,
        result: progress[level.id]?.unaided ? { label: '无提示通关' } : undefined,
        badge: offset === levelsPerChapter - 1 ? '结业挑战' : undefined,
      }),
    ),
  }))

  return (
    <GameLevelPicker
      current={current}
      chapters={chapters}
      scoreSummary={
        <span>
          无提示通关 <strong>{unaided}</strong> / {LOGIC_LEVELS.length}
        </span>
      }
      chapterNote="完成本章任意 4 关，或通过第 5 关结业题，解锁下一章。"
      replayNote="开始挑战将重置盘面，保留通关与无提示记录。"
      onStart={onStart}
      onClose={onClose}
    />
  )
}
