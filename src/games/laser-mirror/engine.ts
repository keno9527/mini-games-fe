export type Direction = 'N' | 'E' | 'S' | 'W'
export type MirrorOrientation = '/' | '\\'

export interface Position {
  row: number
  col: number
}

export interface Emitter extends Position {
  direction: Direction
}

export interface Mirror extends Position {
  orientation: MirrorOrientation
}

export interface LaserLevel {
  id: string
  name: string
  difficulty: '简单' | '中等' | '复杂'
  description: string
  rows: number
  cols: number
  par: number
  emitters: Emitter[]
  mirrors: Mirror[]
  solution: MirrorOrientation[]
  crystals: Position[]
  walls?: Position[]
  splitters?: Position[]
}

export interface BeamEdge {
  from: Position
  to: Position
  direction: Direction
}

export interface TraceResult {
  edges: BeamEdge[]
  energized: Set<string>
  litCrystals: Set<string>
  solved: boolean
}

const DELTAS: Record<Direction, Position> = {
  N: { row: -1, col: 0 },
  E: { row: 0, col: 1 },
  S: { row: 1, col: 0 },
  W: { row: 0, col: -1 },
}

const SLASH_REFLECTION: Record<Direction, Direction> = {
  N: 'E',
  E: 'N',
  S: 'W',
  W: 'S',
}

const BACKSLASH_REFLECTION: Record<Direction, Direction> = {
  N: 'W',
  W: 'N',
  S: 'E',
  E: 'S',
}

const CLOCKWISE: Record<Direction, Direction> = {
  N: 'E',
  E: 'S',
  S: 'W',
  W: 'N',
}

export const positionKey = ({ row, col }: Position) => `${row}:${col}`

export function reflect(direction: Direction, mirror: MirrorOrientation): Direction {
  return mirror === '/' ? SLASH_REFLECTION[direction] : BACKSLASH_REFLECTION[direction]
}

export function rotateMirror(mirror: Mirror): Mirror {
  return { ...mirror, orientation: mirror.orientation === '/' ? '\\' : '/' }
}

export function starsFor(moves: number, par: number, usedHint = false): 1 | 2 | 3 {
  if (usedHint) return 1
  if (moves <= par) return 3
  if (moves <= par + 2) return 2
  return 1
}

export function findHint(level: LaserLevel, mirrors: Mirror[]): number | undefined {
  return mirrors.findIndex((mirror, index) => mirror.orientation !== level.solution[index])
}

export function traceLaser(level: LaserLevel, mirrors: Mirror[] = level.mirrors): TraceResult {
  const mirrorMap = new Map(mirrors.map((mirror) => [positionKey(mirror), mirror.orientation]))
  const walls = new Set((level.walls ?? []).map(positionKey))
  const splitters = new Set((level.splitters ?? []).map(positionKey))
  const crystalKeys = new Set(level.crystals.map(positionKey))
  const litCrystals = new Set<string>()
  const energized = new Set<string>()
  const edges: BeamEdge[] = []
  const queue = level.emitters.map((emitter) => ({ ...emitter }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const state = queue.shift()
    if (!state) break

    const stateKey = `${state.row}:${state.col}:${state.direction}`
    if (visited.has(stateKey)) continue
    visited.add(stateKey)

    const delta = DELTAS[state.direction]
    const next = { row: state.row + delta.row, col: state.col + delta.col }
    if (next.row < 0 || next.row >= level.rows || next.col < 0 || next.col >= level.cols) {
      continue
    }

    edges.push({ from: { row: state.row, col: state.col }, to: next, direction: state.direction })
    const nextKey = positionKey(next)
    energized.add(nextKey)
    if (crystalKeys.has(nextKey)) litCrystals.add(nextKey)
    if (walls.has(nextKey)) continue

    const mirror = mirrorMap.get(nextKey)
    if (mirror) {
      queue.push({ ...next, direction: reflect(state.direction, mirror) })
      continue
    }

    if (splitters.has(nextKey)) {
      queue.push({ ...next, direction: state.direction })
      queue.push({ ...next, direction: CLOCKWISE[state.direction] })
      continue
    }

    queue.push({ ...next, direction: state.direction })
  }

  return {
    edges,
    energized,
    litCrystals,
    solved: crystalKeys.size > 0 && litCrystals.size === crystalKeys.size,
  }
}
