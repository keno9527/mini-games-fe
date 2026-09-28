import { LEVEL_LAYOUTS } from './levels'

export const EDITOR_COLS = 12
export const EDITOR_ROWS = 10
export const CUSTOM_LEVEL_KEY = 'mini-games-breakout-level-v1'
export const BRUSHES = [
  { tile: '1', label: '普通砖', symbol: '●', hint: '击中 1 次消除' },
  { tile: 'H', label: '加固砖', symbol: 'Ⅱ', hint: '击中 2 次消除' },
  { tile: 'X', label: '爆炸砖', symbol: '✦', hint: '引爆周围砖块' },
  { tile: '#', label: '钢砖', symbol: '◆', hint: '无法击碎的障碍' },
  { tile: '.', label: '橡皮擦', symbol: '−', hint: '擦除格子中的砖块' },
] as const
export type Brush = (typeof BRUSHES)[number]['tile']
export type Cell = readonly [number, number]
export interface CustomLevel {
  version: 1
  name: string
  layout: string[]
}
type LevelStorage = Pick<Storage, 'getItem' | 'setItem'>

export function createLevel(template?: number): CustomLevel {
  const source = template === undefined ? undefined : LEVEL_LAYOUTS[template]
  return {
    version: 1,
    name: '我的砖块关卡',
    layout: Array.from(
      { length: EDITOR_ROWS },
      (_, row) => source?.[row] ?? '.'.repeat(EDITOR_COLS),
    ),
  }
}

export function parseLevel(value: unknown): CustomLevel {
  if (!value || typeof value !== 'object') throw new Error('关卡数据格式不正确。')
  const data = value as Record<string, unknown>
  if (data.version !== 1) throw new Error('不支持此关卡版本。')
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 40)
    throw new Error('请填写 1–40 个字符的关卡名称。')
  if (
    !Array.isArray(data.layout) ||
    data.layout.length !== EDITOR_ROWS ||
    !data.layout.every((row) => typeof row === 'string' && /^[.1-9HX#]{12}$/.test(row))
  )
    throw new Error('关卡需为 12 列 × 10 行，且只能使用支持的砖块。')
  return { version: 1, name: data.name.trim(), layout: [...data.layout] }
}

export function breakableCount(layout: string[]): number {
  return [...layout.join('')].filter((tile) => /[1-9HX]/.test(tile)).length
}

export function playableLevel(level: CustomLevel): CustomLevel {
  const valid = parseLevel(level)
  if (breakableCount(valid.layout) === 0) throw new Error('至少放置一块可击碎的砖块后再试玩。')
  return valid
}

export function loadLevel(storage: LevelStorage = localStorage): CustomLevel | null {
  const raw = storage.getItem(CUSTOM_LEVEL_KEY)
  if (raw === null) return null
  try {
    return parseLevel(JSON.parse(raw))
  } catch {
    throw new Error('本地关卡无法读取，原数据已保留。请修复本地数据后再保存。')
  }
}

export function saveLevel(level: CustomLevel, storage: LevelStorage = localStorage): CustomLevel {
  const valid = parseLevel(level)
  // 先校验旧数据，避免用默认画板覆盖无法读取的关卡。
  loadLevel(storage)
  storage.setItem(CUSTOM_LEVEL_KEY, JSON.stringify(valid))
  return valid
}

export function editorError(error: unknown): string {
  if (error instanceof DOMException)
    return '浏览器存储不可用或空间不足，尚未保存；画板仍保留在当前页面中。'
  return error instanceof Error ? error.message : '操作失败，画板仍保留在当前页面中。'
}

/** 用连续线段补齐快速拖动跨过的格子；只返回新布局，不修改原稿。 */
export function paintLine(layout: string[], from: Cell, to: Cell, tile: Brush): string[] {
  const next = [...layout]
  let [x, y] = from
  const [endX, endY] = to
  const dx = Math.abs(endX - x)
  const dy = -Math.abs(endY - y)
  const sx = x < endX ? 1 : -1
  const sy = y < endY ? 1 : -1
  let error = dx + dy
  while (true) {
    if (x >= 0 && x < EDITOR_COLS && y >= 0 && y < EDITOR_ROWS) {
      const row = next[y]
      next[y] = row.slice(0, x) + tile + row.slice(x + 1)
    }
    if (x === endX && y === endY) break
    const twice = error * 2
    if (twice >= dy) {
      error += dy
      x += sx
    }
    if (twice <= dx) {
      error += dx
      y += sy
    }
  }
  return next
}
