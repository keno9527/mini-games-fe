export const BOARD_COLUMNS = 12
export const BOARD_ROWS = 8
export const INITIAL_GOLD = 240
export const INITIAL_LIVES = 12

export type TowerKind = 'sprout' | 'frost' | 'cannon'
export type EnemyKind = 'scout' | 'wisp' | 'brute' | 'boss'
export type GamePhase = 'ready' | 'wave' | 'paused' | 'victory' | 'defeat'

export interface Point {
  x: number
  y: number
}

export interface TowerDefinition {
  name: string
  description: string
  cost: number
  damage: number
  range: number
  fireInterval: number
  color: string
  accent: string
  slowMultiplier?: number
  splash?: number
}

export interface EnemyDefinition {
  name: string
  hp: number
  speed: number
  reward: number
  score: number
  leakDamage: number
  color: string
  radius: number
}

export interface Tower {
  id: number
  kind: TowerKind
  column: number
  row: number
  level: number
  cooldown: number
  invested: number
}

export interface Enemy {
  id: number
  kind: EnemyKind
  hp: number
  maxHp: number
  progress: number
  slowTimer: number
  speedMultiplier: number
}

export interface ShotEffect {
  id: number
  towerId: number
  target: Point
  kind: TowerKind
  life: number
}

export interface GameState {
  phase: GamePhase
  wave: number
  gold: number
  lives: number
  score: number
  elapsed: number
  towers: Tower[]
  enemies: Enemy[]
  shots: ShotEffect[]
  spawnQueue: EnemyKind[]
  spawnTimer: number
  nextId: number
}

export const TOWER_DEFINITIONS: Record<TowerKind, TowerDefinition> = {
  sprout: {
    name: '豆荚射手',
    description: '射速快、造价低，适合守住前段路线。',
    cost: 90,
    damage: 28,
    range: 2.35,
    fireInterval: 0.72,
    color: '#267d3b',
    accent: '#8ee36f',
  },
  frost: {
    name: '露珠法师',
    description: '用寒露减速敌人，为整条防线争取时间。',
    cost: 110,
    damage: 12,
    range: 2.2,
    fireInterval: 0.9,
    color: '#247aa8',
    accent: '#8aeaff',
    slowMultiplier: 0.48,
  },
  cannon: {
    name: '橡果炮台',
    description: '攻击较慢，但爆裂橡果会伤害一群敌人。',
    cost: 145,
    damage: 38,
    range: 2.05,
    fireInterval: 1.35,
    color: '#8b4b25',
    accent: '#ffbd55',
    splash: 0.85,
  },
}

export const ENEMY_DEFINITIONS: Record<EnemyKind, EnemyDefinition> = {
  scout: {
    name: '刺叶虫',
    hp: 66,
    speed: 0.76,
    reward: 16,
    score: 90,
    leakDamage: 3,
    color: '#d95f47',
    radius: 0.22,
  },
  wisp: {
    name: '萤火精',
    hp: 48,
    speed: 1.12,
    reward: 18,
    score: 120,
    leakDamage: 2,
    color: '#9459df',
    radius: 0.18,
  },
  brute: {
    name: '铁壳兽',
    hp: 180,
    speed: 0.5,
    reward: 28,
    score: 210,
    leakDamage: 4,
    color: '#59616b',
    radius: 0.3,
  },
  boss: {
    name: '荒原吞噬者',
    hp: 620,
    speed: 0.38,
    reward: 120,
    score: 1200,
    leakDamage: 12,
    color: '#713b32',
    radius: 0.42,
  },
}

export const PATH_TILES: ReadonlyArray<readonly [number, number]> = [
  [0, 3],
  [1, 3],
  [2, 3],
  [3, 3],
  [3, 2],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 1],
  [7, 1],
  [7, 2],
  [7, 3],
  [7, 4],
  [8, 4],
  [9, 4],
  [10, 4],
  [10, 5],
  [10, 6],
  [11, 6],
]

export const PATH_POINTS: Point[] = PATH_TILES.map(([column, row]) => ({
  x: column + 0.5,
  y: row + 0.5,
}))

export const WAVES: ReadonlyArray<ReadonlyArray<EnemyKind>> = [
  ['scout', 'scout', 'scout', 'scout', 'scout'],
  ['scout', 'wisp', 'scout', 'wisp', 'scout', 'wisp', 'scout'],
  ['brute', 'scout', 'scout', 'brute', 'wisp', 'wisp', 'brute'],
  ['wisp', 'wisp', 'brute', 'scout', 'brute', 'wisp', 'brute', 'scout'],
  ['brute', 'wisp', 'scout', 'brute', 'wisp', 'boss'],
]

const pathTileKeys = new Set(PATH_TILES.map(([column, row]) => `${column}:${row}`))

export function createGameState(): GameState {
  return {
    phase: 'ready',
    wave: 0,
    gold: INITIAL_GOLD,
    lives: INITIAL_LIVES,
    score: 0,
    elapsed: 0,
    towers: [],
    enemies: [],
    shots: [],
    spawnQueue: [],
    spawnTimer: 0,
    nextId: 1,
  }
}

export function createEnemy(kind: EnemyKind, id: number, progress = -0.35): Enemy {
  const definition = ENEMY_DEFINITIONS[kind]
  return {
    id,
    kind,
    hp: definition.hp,
    maxHp: definition.hp,
    progress,
    slowTimer: 0,
    speedMultiplier: 1,
  }
}

export function getEnemyPosition(enemy: Pick<Enemy, 'progress'>): Point {
  const clamped = Math.max(0, Math.min(PATH_POINTS.length - 1, enemy.progress))
  const fromIndex = Math.floor(clamped)
  const toIndex = Math.min(PATH_POINTS.length - 1, fromIndex + 1)
  const fraction = clamped - fromIndex
  const from = PATH_POINTS[fromIndex]
  const to = PATH_POINTS[toIndex]

  return {
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  }
}

export function getTowerStats(tower: Tower): TowerDefinition {
  const base = TOWER_DEFINITIONS[tower.kind]
  const levelScale = 1 + (tower.level - 1) * 0.42

  return {
    ...base,
    damage: base.damage * levelScale,
    range: base.range + (tower.level - 1) * 0.12,
    fireInterval: base.fireInterval / (1 + (tower.level - 1) * 0.16),
  }
}

export function getUpgradeCost(tower: Tower): number | null {
  if (tower.level >= 3) return null
  return Math.round(TOWER_DEFINITIONS[tower.kind].cost * (0.45 + tower.level * 0.25))
}

export function canPlaceTower(
  state: GameState,
  kind: TowerKind,
  column: number,
  row: number,
): { ok: boolean; reason: string } {
  if (state.phase === 'victory' || state.phase === 'defeat') {
    return { ok: false, reason: '本局已经结束' }
  }
  if (column < 0 || column >= BOARD_COLUMNS || row < 0 || row >= BOARD_ROWS) {
    return { ok: false, reason: '这里超出林地范围' }
  }
  if (pathTileKeys.has(`${column}:${row}`)) {
    return { ok: false, reason: '不能堵住萤石小径' }
  }
  if (state.towers.some(tower => tower.column === column && tower.row === row)) {
    return { ok: false, reason: '这里已经有一座防御塔' }
  }
  if (state.gold < TOWER_DEFINITIONS[kind].cost) {
    return { ok: false, reason: '阳光不足' }
  }
  return { ok: true, reason: '' }
}

export function placeTower(
  state: GameState,
  kind: TowerKind,
  column: number,
  row: number,
): GameState {
  if (!canPlaceTower(state, kind, column, row).ok) return state

  const definition = TOWER_DEFINITIONS[kind]
  return {
    ...state,
    gold: state.gold - definition.cost,
    nextId: state.nextId + 1,
    towers: [
      ...state.towers,
      {
        id: state.nextId,
        kind,
        column,
        row,
        level: 1,
        cooldown: 0,
        invested: definition.cost,
      },
    ],
  }
}

export function upgradeTower(state: GameState, towerId: number): GameState {
  const tower = state.towers.find(item => item.id === towerId)
  if (!tower) return state
  const cost = getUpgradeCost(tower)
  if (cost === null || state.gold < cost) return state

  return {
    ...state,
    gold: state.gold - cost,
    towers: state.towers.map(item =>
      item.id === towerId
        ? { ...item, level: item.level + 1, invested: item.invested + cost }
        : item,
    ),
  }
}

export function sellTower(state: GameState, towerId: number): GameState {
  const tower = state.towers.find(item => item.id === towerId)
  if (!tower) return state

  return {
    ...state,
    gold: state.gold + Math.round(tower.invested * 0.7),
    towers: state.towers.filter(item => item.id !== towerId),
  }
}

export function startNextWave(state: GameState): GameState {
  if (state.phase !== 'ready' || state.wave >= WAVES.length) return state

  return {
    ...state,
    phase: 'wave',
    wave: state.wave + 1,
    spawnQueue: [...WAVES[state.wave]],
    spawnTimer: 0,
  }
}

export function togglePause(state: GameState): GameState {
  if (state.phase === 'wave') return { ...state, phase: 'paused' }
  if (state.phase === 'paused') return { ...state, phase: 'wave' }
  return state
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function finishWaveIfNeeded(state: GameState): GameState {
  if (state.phase !== 'wave' || state.spawnQueue.length > 0 || state.enemies.length > 0) {
    return state
  }
  if (state.wave >= WAVES.length) {
    return { ...state, phase: 'victory', score: state.score + state.lives * 100 }
  }
  return {
    ...state,
    phase: 'ready',
    gold: state.gold + 45 + state.wave * 10,
    score: state.score + state.wave * 75,
  }
}

export function stepGame(state: GameState, deltaSeconds: number): GameState {
  if (state.phase !== 'wave') return state

  const delta = Math.max(0, Math.min(deltaSeconds, 60))
  let nextId = state.nextId
  const spawnQueue = [...state.spawnQueue]
  const enemies = state.enemies.map(enemy => ({ ...enemy }))
  const towers = state.towers.map(tower => ({ ...tower }))
  let spawnTimer = state.spawnTimer - delta

  while (spawnQueue.length > 0 && spawnTimer <= 0) {
    enemies.push(createEnemy(spawnQueue.shift()!, nextId))
    nextId += 1
    spawnTimer += 0.82
  }

  let lives = state.lives
  const activeEnemies: Enemy[] = []
  for (const enemy of enemies) {
    const definition = ENEMY_DEFINITIONS[enemy.kind]
    const slowed = enemy.slowTimer > 0
    enemy.progress += definition.speed * (slowed ? enemy.speedMultiplier : 1) * delta
    enemy.slowTimer = Math.max(0, enemy.slowTimer - delta)

    if (enemy.progress >= PATH_POINTS.length - 1) {
      lives = Math.max(0, lives - definition.leakDamage)
    } else {
      activeEnemies.push(enemy)
    }
  }

  const baseState: GameState = {
    ...state,
    lives,
    elapsed: state.elapsed + delta,
    towers,
    enemies: activeEnemies,
    shots: state.shots
      .map(shot => ({ ...shot, life: shot.life - delta }))
      .filter(shot => shot.life > 0),
    spawnQueue,
    spawnTimer,
    nextId,
  }

  if (lives <= 0) {
    return { ...baseState, phase: 'defeat' }
  }

  for (const tower of towers) {
    tower.cooldown -= delta
    if (tower.cooldown > 0) continue

    const stats = getTowerStats(tower)
    const towerPosition = { x: tower.column + 0.5, y: tower.row + 0.5 }
    const target = activeEnemies
      .filter(enemy => enemy.hp > 0 && distance(towerPosition, getEnemyPosition(enemy)) <= stats.range)
      .sort((left, right) => right.progress - left.progress)[0]

    if (!target) {
      tower.cooldown = 0
      continue
    }

    const targetPosition = getEnemyPosition(target)
    const victims = stats.splash
      ? activeEnemies.filter(enemy => distance(getEnemyPosition(enemy), targetPosition) <= stats.splash!)
      : [target]

    victims.forEach(enemy => {
      enemy.hp -= stats.damage
      if (stats.slowMultiplier) {
        enemy.slowTimer = Math.max(enemy.slowTimer, 1.8)
        enemy.speedMultiplier = Math.min(enemy.speedMultiplier, stats.slowMultiplier)
      }
    })
    tower.cooldown = stats.fireInterval
    baseState.shots.push({
      id: baseState.nextId,
      towerId: tower.id,
      target: targetPosition,
      kind: tower.kind,
      life: 0.14,
    })
    baseState.nextId += 1
  }

  let gold = state.gold
  let score = state.score
  const survivors = activeEnemies.filter(enemy => {
    if (enemy.hp > 0) return true
    const definition = ENEMY_DEFINITIONS[enemy.kind]
    gold += definition.reward
    score += definition.score
    return false
  })

  return finishWaveIfNeeded({
    ...baseState,
    gold,
    score,
    enemies: survivors,
    towers,
  })
}
