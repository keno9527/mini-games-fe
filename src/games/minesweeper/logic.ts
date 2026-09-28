import { type CellState } from './engine'
import { LOGIC_LEVELS, type LogicLevel } from './levels'

export const CHAPTERS = ['看懂数字', '线索之间', '纵观全局', '新的线索']
export const LESSONS = [
  '未知格数等于剩余雷数时，它们全是雷；雷数已满时，其余格都安全。',
  '比较两组有包含关系的候选格，用雷数之差判断多出的格子。',
  '全盘总雷数也是线索。剩余雷集中在一组时，组外就安全。',
  '额外线索给出指定行或区域的总雷数，重叠格在各条线索中分别计数。',
]
export const coordinate = (index: number, cols: number) =>
  `${String.fromCharCode(65 + (index % cols))}${Math.floor(index / cols) + 1}`
export function neighbors(index: number, rows: number, cols: number) {
  return Array.from({ length: rows * cols }, (_, i) => i).filter(
    (i) =>
      i !== index &&
      Math.abs(Math.floor(i / cols) - Math.floor(index / cols)) <= 1 &&
      Math.abs((i % cols) - (index % cols)) <= 1,
  )
}
export function createLogicBoard(level: LogicLevel): CellState[][] {
  return Array.from({ length: level.rows }, (_, r) =>
    Array.from({ length: level.cols }, (_, c) => {
      const i = r * level.cols + c
      return {
        mine: level.mines.includes(i),
        revealed: level.initial.includes(i),
        flagged: false,
        adjacent: neighbors(i, level.rows, level.cols).filter((n) => level.mines.includes(n))
          .length,
      }
    }),
  )
}
interface Constraint {
  cells: number[]
  count: number
  label: string
  anchors: number[]
}
export interface LogicHint {
  cells: number[]
  mine: boolean
  focus: number[]
  observation: string
  reason: string
}
/** Uses visible numbers and public totals only. Flags are notes, never premises. */
export function findLogicHint(board: CellState[][], level: LogicLevel): LogicHint | null {
  const flat = board.flat()
  const known = new Set<number>()
  for (let pass = 0; pass <= flat.length; pass++) {
    const reduce = (
      cells: number[],
      count: number,
      label: string,
      anchors: number[],
    ): Constraint => ({
      cells: cells.filter((i) => !flat[i].revealed && !known.has(i)),
      count: count - cells.filter((i) => known.has(i)).length,
      label,
      anchors,
    })
    const constraints = flat.flatMap((cell, i) =>
      cell.revealed
        ? [
            reduce(
              neighbors(i, level.rows, level.cols),
              cell.adjacent,
              `${coordinate(i, level.cols)} 的数字 ${cell.adjacent}`,
              [i],
            ),
          ]
        : [],
    )
    if (level.id >= 11)
      constraints.push(
        reduce(
          flat.map((_, i) => i),
          level.mines.length,
          `全盘总数 ${level.mines.length} 雷`,
          [],
        ),
      )
    for (const extra of level.extras)
      constraints.push(
        reduce(extra.cells, extra.count, `${extra.name}（${extra.count} 雷）`, extra.cells),
      )
    const candidates: LogicHint[] = []
    const consider = (cells: number[], count: number, sources: Constraint[]) => {
      if (!cells.length || (count !== 0 && count !== cells.length)) return
      candidates.push({
        cells,
        mine: count > 0,
        focus: [...new Set(sources.flatMap((s) => [...s.anchors, ...s.cells]))],
        observation: `观察${sources.map((s) => s.label).join('与')}。`,
        reason:
          (known.size
            ? `已由数字线索确认的雷：${[...known].map((i) => coordinate(i, level.cols)).join('、')}；先从相关雷数中扣除。`
            : '') +
          sources
            .map(
              (s) =>
                `${s.label}的剩余候选格 {${s.cells.map((i) => coordinate(i, level.cols)).join('、')}} 中有 ${s.count} 雷`,
            )
            .join('；') +
          (sources.length > 1
            ? `。两组相减，多出的 ${cells.length} 格共有 ${count} 雷。`
            : `。${count === 0 ? '雷数已满足，其余候选格安全。' : '候选格数等于雷数，因此全部是雷。'}`),
      })
    }
    for (const a of constraints) consider(a.cells, a.count, [a])
    if (level.id >= 6)
      for (const a of constraints)
        for (const b of constraints) {
          if (
            a.cells.length &&
            a.cells.length < b.cells.length &&
            a.cells.every((i) => b.cells.includes(i))
          )
            consider(
              b.cells.filter((i) => !a.cells.includes(i)),
              b.count - a.count,
              [a, b],
            )
        }
    const safe = candidates.find((h) => !h.mine)
    if (safe) return safe
    const mine = candidates.find((h) => h.mine && h.cells.some((i) => !flat[i].flagged))
    if (mine) return mine
    const before = known.size
    for (const hint of candidates) if (hint.mine) for (const i of hint.cells) known.add(i)
    if (before === known.size) return null
  }
  return null
}
export type LogicProgress = Record<number, { completed: boolean; unaided: boolean }>
export function chapterUnlocked(chapter: number, progress: LogicProgress): boolean {
  if (chapter === 0) return true
  return (
    chapterUnlocked(chapter - 1, progress) &&
    (Boolean(progress[chapter * 5]?.completed) ||
      LOGIC_LEVELS.slice((chapter - 1) * 5, chapter * 5).filter((l) => progress[l.id]?.completed)
        .length >= 4)
  )
}
export function completeLevel(
  progress: LogicProgress,
  id: number,
  unaided: boolean,
): LogicProgress {
  return {
    ...progress,
    [id]: { completed: true, unaided: Boolean(progress[id]?.unaided || unaided) },
  }
}
export function parseProgress(raw: string | null): LogicProgress {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}')
    if (!parsed || typeof parsed !== 'object') return {}
    const result: LogicProgress = {}
    for (const level of LOGIC_LEVELS) {
      const item = (parsed as Record<number, unknown>)[level.id]
      if (item && typeof item === 'object' && 'completed' in item && item.completed === true)
        result[level.id] = { completed: true, unaided: 'unaided' in item && item.unaided === true }
    }
    return result
  } catch {
    return {}
  }
}
