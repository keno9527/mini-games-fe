import GameLevelPicker, { type PickerChapter } from '@/components/GameLevelPicker'
import { CHAPTERS, PUZZLE_LEVELS } from './levels'
import { MiniBoard } from './PuzzleBoard'
import type { PuzzleProgress } from './progression'

interface Props {
  current: number
  progress: PuzzleProgress
  onStart: (id: number) => void
  onClose: () => void
}

const levelsPerChapter = 6

export default function LevelPicker({ current, progress, onStart, onClose }: Props) {
  const independent = PUZZLE_LEVELS.filter((level) => progress[level.id] === 2).length
  const chapters: PickerChapter[] = CHAPTERS.map((chapter, index) => ({
    name: chapter.name,
    description: chapter.lesson,
    levels: PUZZLE_LEVELS.slice(index * levelsPerChapter, (index + 1) * levelsPerChapter).map(
      (level) => ({
        id: level.id,
        name: level.name,
        objective: `${level.moves} 手内获胜`,
        description: `执黑先行 · ${level.moves} 手内获胜`,
        completed: !!progress[level.id],
        result: progress[level.id] === 2 ? { label: '独立完成' } : undefined,
        preview: <MiniBoard board={level.board} />,
      }),
    ),
  }))

  return (
    <GameLevelPicker
      current={current}
      chapters={chapters}
      scoreSummary={
        <span>
          独立完成 <strong>{independent}</strong> / {PUZZLE_LEVELS.length}
        </span>
      }
      chapterNote="全部关卡均可自由选择。"
      replayNote="开始挑战将重置棋局，保留最佳通关记录。"
      onStart={onStart}
      onClose={onClose}
    >
      <details className="level-picker-rules">
        <summary>玩法说明</summary>
        <p>15×15 自由五子棋，五连及以上获胜，没有禁手。黑棋先行，手数只统计黑棋。</p>
        <p>
          每次非终结落子都需形成“下一手能成五”的冲四威胁；白棋会优先获胜，否则封堵。连续进攻，在限定手数内取胜。
        </p>
        <p>
          提示依次提供战术、区域和参考解法。使用提示或悔棋仍可通关；本次未使用两者则记为独立完成。
        </p>
        <p>方向键移动焦点，回车落子；触屏可拖动预览，抬手落子，移出棋盘取消。</p>
      </details>
    </GameLevelPicker>
  )
}
