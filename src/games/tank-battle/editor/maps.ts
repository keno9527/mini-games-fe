import {
  CELL_SIZE,
  ENEMIES_PER_LEVEL,
  FIELD_PIXELS,
  GRID_SIZE,
} from '@/games/tank-battle/constants.ts'
import {
  BASE_CELL,
  BASE_WALL_CELLS,
  ENEMY_SPAWN_CELLS,
  LEVELS,
  PLAYER_SPAWN_CELL,
} from '@/games/tank-battle/data/levels.ts'
import { TerrainGrid } from '@/games/tank-battle/system/TerrainGrid.ts'
import { EnemyKind, type LevelData } from '@/games/tank-battle/types.ts'

export const MAP_FORMAT = 'battle-city-map'
export const MAX_IMPORT_BYTES = 64 * 1024
export const TILE_CHARACTERS = '.#@~*%>v<^rblt'
export interface CustomMap extends LevelData {
  readonly format: typeof MAP_FORMAT
  readonly version: 1
  readonly id: string
  readonly name: string
  readonly updatedAt: string
}
export interface MapIssue {
  readonly message: string
  readonly cell?: readonly [number, number]
}
export const WAVE_PRESETS = {
  balanced: {
    label: '均衡部队',
    queue: [
      ...Array<EnemyKind>(12).fill(EnemyKind.BASIC),
      ...Array<EnemyKind>(4).fill(EnemyKind.FAST),
      ...Array<EnemyKind>(2).fill(EnemyKind.POWER),
      ...Array<EnemyKind>(2).fill(EnemyKind.ARMOR),
    ],
  },
  fast: {
    label: '快速突袭',
    queue: [
      ...Array<EnemyKind>(8).fill(EnemyKind.BASIC),
      ...Array<EnemyKind>(10).fill(EnemyKind.FAST),
      ...Array<EnemyKind>(2).fill(EnemyKind.POWER),
    ],
  },
  armor: {
    label: '重甲进攻',
    queue: [
      ...Array<EnemyKind>(8).fill(EnemyKind.BASIC),
      ...Array<EnemyKind>(4).fill(EnemyKind.POWER),
      ...Array<EnemyKind>(8).fill(EnemyKind.ARMOR),
    ],
  },
} as const

export function protectedCell(x: number, y: number): string | null {
  if (BASE_CELL[0] === x && BASE_CELL[1] === y) return '老鹰基地'
  if (PLAYER_SPAWN_CELL[0] === x && PLAYER_SPAWN_CELL[1] === y) return '玩家出生点'
  if (ENEMY_SPAWN_CELLS.some(([cx, cy]) => cx === x && cy === y)) return '敌军出生点'
  if (BASE_WALL_CELLS.some(([cx, cy]) => cx === x && cy === y)) return '基地围墙'
  return null
}

export function createMap(source?: number): CustomMap {
  const original = source === undefined ? undefined : LEVELS[source]
  return {
    format: MAP_FORMAT,
    version: 1,
    id: crypto.randomUUID(),
    name: original ? `经典第 ${source! + 1} 关 · 副本` : '我的新地图',
    updatedAt: new Date().toISOString(),
    terrain: Array.from({ length: GRID_SIZE }, (_, y) =>
      Array.from({ length: GRID_SIZE }, (_, x) =>
        protectedCell(x, y) ? '.' : (original?.terrain[y][x] ?? '.'),
      ).join(''),
    ),
    enemyQueue: [...(original?.enemyQueue ?? WAVE_PRESETS.balanced.queue)],
  }
}

export function validateLevel(value: unknown): MapIssue[] {
  if (!value || typeof value !== 'object') return [{ message: '地图数据必须是对象。' }]
  const { terrain, enemyQueue } = value as Record<string, unknown>
  const issues: MapIssue[] = []
  if (
    !Array.isArray(terrain) ||
    terrain.length !== GRID_SIZE ||
    !terrain.every((row) => typeof row === 'string' && row.length === GRID_SIZE)
  ) {
    issues.push({ message: '地图必须为 13 行，每行 13 个格子。' })
  } else {
    terrain.forEach((row: string, y: number) =>
      [...row].forEach((tile, x) => {
        if (!TILE_CHARACTERS.includes(tile))
          issues.push({ message: `第 ${y + 1} 行、第 ${x + 1} 列的地形无效。`, cell: [x, y] })
        else if (protectedCell(x, y) && tile !== '.')
          issues.push({
            message: `第 ${y + 1} 行、第 ${x + 1} 列属于${protectedCell(x, y)}，不能覆盖。`,
            cell: [x, y],
          })
      }),
    )
  }
  if (
    !Array.isArray(enemyQueue) ||
    enemyQueue.length !== ENEMIES_PER_LEVEL ||
    !enemyQueue.every((kind) => Object.values(EnemyKind).includes(kind))
  )
    issues.push({ message: '敌军队列必须包含 20 辆有效类型的坦克。' })
  return issues
}

/** 只给风险提示；以完整坦克和半格步长检查，不把窄缝误认为可通行。 */
export function mapWarnings(level: LevelData): MapIssue[] {
  if (validateLevel(level).length) return []
  const terrain = new TerrainGrid(level.terrain)
  const warnings: MapIssue[] = []
  for (const [x, y] of [PLAYER_SPAWN_CELL, ...ENEMY_SPAWN_CELLS]) {
    const blocked = [
      [0, -8],
      [8, 0],
      [0, 8],
      [-8, 0],
    ].every(([dx, dy]) =>
      terrain.blocksTank({
        x: x * CELL_SIZE + dx,
        y: y * CELL_SIZE + dy,
        width: CELL_SIZE,
        height: CELL_SIZE,
      }),
    )
    if (blocked)
      warnings.push({
        message: `${protectedCell(x, y)}（${x + 1}, ${y + 1}）出口受阻，可能需要先破墙。`,
        cell: [x, y],
      })
  }
  // 假设普通砖已清除，钢墙和水仍不可穿过。基地围墙保留以避免穿越基地。
  const open = new TerrainGrid(level.terrain.map((row) => row.replace(/[#><v^]/g, '.')))
  const size = (FIELD_PIXELS - CELL_SIZE) / 8 + 1
  const start = [PLAYER_SPAWN_CELL[0] * 2, PLAYER_SPAWN_CELL[1] * 2]
  const visited = new Set<string>([start.join(',')])
  const queue = [start]
  for (let i = 0; i < queue.length; i += 1) {
    const [x, y] = queue[i]
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        key = `${nx},${ny}`
      if (nx < 0 || ny < 0 || nx >= size || ny >= size || visited.has(key)) continue
      if (open.blocksTank({ x: nx * 8, y: ny * 8, width: CELL_SIZE, height: CELL_SIZE })) continue
      visited.add(key)
      queue.push([nx, ny])
    }
  }
  if (ENEMY_SPAWN_CELLS.some(([x, y]) => !visited.has(`${x * 2},${y * 2}`)))
    warnings.push({
      message: '部分敌军出生区与玩家之间有水或钢墙隔断；可能需要升级或远程射击，请试玩确认。',
    })
  return warnings
}

/** 不信任外部元数据，导入时只复制白名单字段并重新分配本地 ID。 */
export function parseMap(value: unknown, keepIdentity = false, allowUnnamed = false): CustomMap {
  if (!value || typeof value !== 'object') throw new Error('地图文件格式不正确。')
  const data = value as Record<string, unknown>
  if (data.format !== MAP_FORMAT || data.version !== 1) throw new Error('不支持此地图格式或版本。')
  if (
    typeof data.name !== 'string' ||
    data.name.length > 40 ||
    (!allowUnnamed && !data.name.trim())
  )
    throw new Error('地图名称需为 1–40 个字符。')
  const issues = validateLevel(data)
  if (issues.length) throw new Error(issues[0].message)
  if (
    keepIdentity &&
    (typeof data.id !== 'string' ||
      !data.id ||
      data.id.length > 100 ||
      typeof data.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(data.updatedAt)))
  )
    throw new Error('本地地图信息损坏，请先导出备份。')
  return {
    format: MAP_FORMAT,
    version: 1,
    id: keepIdentity ? (data.id as string) : crypto.randomUUID(),
    name: data.name.trim(),
    updatedAt: keepIdentity ? (data.updatedAt as string) : new Date().toISOString(),
    terrain: [...(data.terrain as string[])],
    enemyQueue: [...(data.enemyQueue as EnemyKind[])],
  }
}
export function importMap(text: string): CustomMap {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES)
    throw new Error('地图文件不能超过 64 KB。')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('无法读取 JSON，请选择导出的地图文件。')
  }
  return parseMap(value)
}
export function exportMap(map: CustomMap): string {
  const valid = parseMap(map, true)
  return JSON.stringify(
    {
      format: valid.format,
      version: valid.version,
      name: valid.name,
      terrain: valid.terrain,
      enemyQueue: valid.enemyQueue,
    },
    null,
    2,
  )
}

/** 连续笔触采用整数直线补点，快速拖动也不会跳格。 */
export function paintLine(
  terrain: readonly string[],
  from: readonly [number, number],
  to: readonly [number, number],
  tile: string,
): string[] {
  const result = terrain.map((row) => [...row])
  if (tile.length !== 1 || !TILE_CHARACTERS.includes(tile)) return [...terrain]
  let [x, y] = from
  const [endX, endY] = to
  const dx = Math.abs(endX - x),
    dy = -Math.abs(endY - y)
  const sx = x < endX ? 1 : -1,
    sy = y < endY ? 1 : -1
  let error = dx + dy
  while (true) {
    if (x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && !protectedCell(x, y))
      result[y][x] = tile
    if (x === endX && y === endY) break
    const e2 = 2 * error
    if (e2 >= dy) {
      error += dy
      x += sx
    }
    if (e2 <= dx) {
      error += dx
      y += sy
    }
  }
  return result.map((row) => row.join(''))
}
