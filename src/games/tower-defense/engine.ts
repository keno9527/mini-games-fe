export const BOARD_COLUMNS = 12
export const BOARD_ROWS = 8
export const INITIAL_GOLD = 280
export const INITIAL_LIVES = 20
export const MAX_TOWER_LEVEL = 3

export type TowerKind = 'sprout' | 'frost' | 'cannon' | 'sun' | 'magic' | 'spike'
export type EnemyKind = 'scout' | 'wisp' | 'brute' | 'flyer' | 'splitter' | 'boss'
export type SkillKind = 'freeze' | 'gold' | 'bomb'
export type ObstacleKind = 'rock' | 'chest' | 'crystal'
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
  canHitAir: boolean
  canHitGround: boolean
  slowMultiplier?: number
  slowDuration?: number
  splash?: number
  chainCount?: number
  chainRange?: number
  burnDamage?: number
  burnDuration?: number
  stunDuration?: number
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
  isFlying: boolean
  splitInto?: EnemyKind
  splitCount?: number
}

export interface ObstacleDefinition {
  name: string
  hp: number
  reward: number
  color: string
  accent: string
}

export interface SkillDefinition {
  name: string
  description: string
  cooldown: number
  icon: string
  color: string
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
  stunTimer: number
  burnTimer: number
  burnDps: number
}

export interface Obstacle {
  id: number
  kind: ObstacleKind
  column: number
  row: number
  hp: number
  maxHp: number
  reward: number
}

export interface ShotEffect {
  id: number
  fromX: number
  fromY: number
  targetX: number
  targetY: number
  kind: TowerKind
  life: number
  maxLife: number
  isChain?: boolean
}

export interface FloatingText {
  id: number
  x: number
  y: number
  text: string
  color: string
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
  obstacles: Obstacle[]
  shots: ShotEffect[]
  floatingTexts: FloatingText[]
  spawnQueue: EnemyKind[]
  spawnTimer: number
  nextId: number
  skillCooldowns: Record<SkillKind, number>
  combo: number
  comboTimer: number
  kills: number
}

export const TOWER_DEFINITIONS: Record<TowerKind, TowerDefinition> = {
  sprout: {
    name: '豌豆射手',
    description: '射速快、造价低，可攻击空中单位，守住前段路线的好手。',
    cost: 80,
    damage: 22,
    range: 2.5,
    fireInterval: 0.6,
    color: '#267d3b',
    accent: '#8ee36f',
    canHitAir: true,
    canHitGround: true,
  },
  frost: {
    name: '冰冻星',
    description: '范围减速所有敌人，为整条防线争取时间，可攻击空中。',
    cost: 120,
    damage: 8,
    range: 2.0,
    fireInterval: 1.0,
    color: '#247aa8',
    accent: '#8aeaff',
    canHitAir: true,
    canHitGround: true,
    slowMultiplier: 0.45,
    slowDuration: 2.2,
    splash: 1.2,
  },
  cannon: {
    name: '火箭筒',
    description: '攻击较慢，但爆裂火箭会伤害一群地面敌人。无法攻击空中。',
    cost: 160,
    damage: 48,
    range: 2.2,
    fireInterval: 1.4,
    color: '#8b4b25',
    accent: '#ffbd55',
    canHitAir: false,
    canHitGround: true,
    splash: 0.9,
  },
  sun: {
    name: '太阳花',
    description: '近距离持续灼烧地面敌人，造成燃烧伤害。无法攻击空中。',
    cost: 140,
    damage: 14,
    range: 1.6,
    fireInterval: 0.5,
    color: '#d4761a',
    accent: '#ffd24a',
    canHitAir: false,
    canHitGround: true,
    burnDamage: 10,
    burnDuration: 2.5,
    splash: 0.7,
  },
  magic: {
    name: '魔法球',
    description: '发射魔法弹，在敌人之间弹射，可攻击空中单位。',
    cost: 180,
    damage: 30,
    range: 2.3,
    fireInterval: 1.1,
    color: '#6b3fa0',
    accent: '#c89bff',
    canHitAir: true,
    canHitGround: true,
    chainCount: 3,
    chainRange: 1.5,
  },
  spike: {
    name: '鱼刺',
    description: '高伤害单体攻击，附带眩晕效果。无法攻击空中。',
    cost: 150,
    damage: 58,
    range: 2.0,
    fireInterval: 1.6,
    color: '#5a6e7a',
    accent: '#b8d4e0',
    canHitAir: false,
    canHitGround: true,
    stunDuration: 0.8,
  },
}

export const ENEMY_DEFINITIONS: Record<EnemyKind, EnemyDefinition> = {
  scout: {
    name: '小怪',
    hp: 60,
    speed: 0.8,
    reward: 12,
    score: 80,
    leakDamage: 2,
    color: '#d95f47',
    radius: 0.2,
    isFlying: false,
  },
  wisp: {
    name: '萤火精',
    hp: 42,
    speed: 1.25,
    reward: 15,
    score: 100,
    leakDamage: 2,
    color: '#9459df',
    radius: 0.17,
    isFlying: false,
  },
  brute: {
    name: '铁壳兽',
    hp: 220,
    speed: 0.48,
    reward: 26,
    score: 180,
    leakDamage: 4,
    color: '#59616b',
    radius: 0.28,
    isFlying: false,
  },
  flyer: {
    name: '飞行怪',
    hp: 95,
    speed: 0.92,
    reward: 20,
    score: 140,
    leakDamage: 3,
    color: '#3a8fb7',
    radius: 0.21,
    isFlying: true,
  },
  splitter: {
    name: '分裂怪',
    hp: 130,
    speed: 0.62,
    reward: 22,
    score: 160,
    leakDamage: 3,
    color: '#4a9b5a',
    radius: 0.24,
    isFlying: false,
    splitInto: 'scout',
    splitCount: 2,
  },
  boss: {
    name: '荒原吞噬者',
    hp: 900,
    speed: 0.34,
    reward: 180,
    score: 2000,
    leakDamage: 15,
    color: '#713b32',
    radius: 0.4,
    isFlying: false,
  },
}

export const OBSTACLE_DEFINITIONS: Record<ObstacleKind, ObstacleDefinition> = {
  rock: {
    name: '巨石',
    hp: 90,
    reward: 35,
    color: '#7a7a7a',
    accent: '#a8a8a8',
  },
  chest: {
    name: '宝箱',
    hp: 60,
    reward: 60,
    color: '#8b5a2b',
    accent: '#ffd700',
  },
  crystal: {
    name: '水晶',
    hp: 110,
    reward: 45,
    color: '#9b59b6',
    accent: '#d4a5ff',
  },
}

export const SKILL_DEFINITIONS: Record<SkillKind, SkillDefinition> = {
  freeze: {
    name: '全屏冰冻',
    description: '所有敌人减速60%，持续3秒',
    cooldown: 25,
    icon: '❄',
    color: '#4fc3f7',
  },
  gold: {
    name: '金币雨',
    description: '立即获得120金币',
    cooldown: 30,
    icon: '☀',
    color: '#ffd54f',
  },
  bomb: {
    name: '陨石轰炸',
    description: '对所有敌人造成90点伤害',
    cooldown: 35,
    icon: '☄',
    color: '#ff7043',
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

export const OBSTACLE_SPAWNS: ReadonlyArray<readonly [number, number, ObstacleKind]> = [
  [1, 1, 'rock'],
  [5, 3, 'chest'],
  [9, 2, 'crystal'],
  [2, 6, 'rock'],
  [8, 6, 'chest'],
  [5, 5, 'crystal'],
  [11, 1, 'rock'],
]

export const WAVES: ReadonlyArray<ReadonlyArray<EnemyKind>> = [
  ['scout', 'scout', 'scout', 'scout', 'scout', 'scout'],
  ['scout', 'wisp', 'scout', 'wisp', 'scout', 'wisp', 'scout', 'wisp'],
  ['brute', 'scout', 'scout', 'brute', 'wisp', 'wisp', 'brute', 'scout'],
  ['flyer', 'flyer', 'scout', 'flyer', 'scout', 'flyer', 'scout', 'flyer'],
  ['splitter', 'wisp', 'splitter', 'wisp', 'brute', 'splitter', 'wisp', 'brute'],
  ['flyer', 'splitter', 'brute', 'flyer', 'splitter', 'brute', 'wisp', 'wisp', 'flyer'],
  ['brute', 'splitter', 'flyer', 'brute', 'splitter', 'flyer', 'wisp', 'brute', 'splitter', 'flyer'],
  ['brute', 'splitter', 'flyer', 'brute', 'boss', 'splitter', 'flyer', 'brute', 'wisp', 'splitter'],
]

const pathTileKeys = new Set(PATH_TILES.map(([column, row]) => `${column}:${row}`))
const obstacleSpawnKeys = new Set(OBSTACLE_SPAWNS.map(([c, r]) => `${c}:${r}`))

export function createGameState(): GameState {
  let nextId = 1
  const obstacles: Obstacle[] = OBSTACLE_SPAWNS.map(([column, row, kind]) => {
    const def = OBSTACLE_DEFINITIONS[kind]
    return {
      id: nextId++,
      kind,
      column,
      row,
      hp: def.hp,
      maxHp: def.hp,
      reward: def.reward,
    }
  })

  return {
    phase: 'ready',
    wave: 0,
    gold: INITIAL_GOLD,
    lives: INITIAL_LIVES,
    score: 0,
    elapsed: 0,
    towers: [],
    enemies: [],
    obstacles,
    shots: [],
    floatingTexts: [],
    spawnQueue: [],
    spawnTimer: 0,
    nextId,
    skillCooldowns: { freeze: 0, gold: 0, bomb: 0 },
    combo: 0,
    comboTimer: 0,
    kills: 0,
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
    stunTimer: 0,
    burnTimer: 0,
    burnDps: 0,
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
  const levelScale = 1 + (tower.level - 1) * 0.45

  return {
    ...base,
    damage: base.damage * levelScale,
    range: base.range + (tower.level - 1) * 0.12,
    fireInterval: base.fireInterval / (1 + (tower.level - 1) * 0.18),
    burnDamage: base.burnDamage ? base.burnDamage * levelScale : undefined,
    splash: base.splash ? base.splash + (tower.level - 1) * 0.08 : undefined,
    chainCount: base.chainCount ? base.chainCount + (tower.level - 1) : undefined,
    stunDuration: base.stunDuration ? base.stunDuration + (tower.level - 1) * 0.15 : undefined,
  }
}

export function getUpgradeCost(tower: Tower): number | null {
  if (tower.level >= MAX_TOWER_LEVEL) return null
  return Math.round(TOWER_DEFINITIONS[tower.kind].cost * (0.5 + tower.level * 0.3))
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
  if (obstacleSpawnKeys.has(`${column}:${row}`) && state.obstacles.some((o) => o.column === column && o.row === row)) {
    return { ok: false, reason: '这里有障碍物，先清除它' }
  }
  if (state.towers.some((tower) => tower.column === column && tower.row === row)) {
    return { ok: false, reason: '这里已经有一座防御塔' }
  }
  if (state.gold < TOWER_DEFINITIONS[kind].cost) {
    return { ok: false, reason: '金币不足' }
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
  const tower = state.towers.find((item) => item.id === towerId)
  if (!tower) return state
  const cost = getUpgradeCost(tower)
  if (cost === null || state.gold < cost) return state

  return {
    ...state,
    gold: state.gold - cost,
    towers: state.towers.map((item) =>
      item.id === towerId
        ? { ...item, level: item.level + 1, invested: item.invested + cost }
        : item,
    ),
  }
}

export function sellTower(state: GameState, towerId: number): GameState {
  const tower = state.towers.find((item) => item.id === towerId)
  if (!tower) return state

  return {
    ...state,
    gold: state.gold + Math.round(tower.invested * 0.7),
    towers: state.towers.filter((item) => item.id !== towerId),
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

export function useSkill(state: GameState, skill: SkillKind): GameState {
  if (state.phase !== 'wave' && state.phase !== 'ready') return state
  if (state.skillCooldowns[skill] > 0) return state

  const def = SKILL_DEFINITIONS[skill]
  let nextState = { ...state, skillCooldowns: { ...state.skillCooldowns, [skill]: def.cooldown } }

  if (skill === 'freeze') {
    nextState = {
      ...nextState,
      enemies: nextState.enemies.map((e) => ({
        ...e,
        slowTimer: Math.max(e.slowTimer, 3),
        speedMultiplier: Math.min(e.speedMultiplier, 0.4),
      })),
      floatingTexts: [
        ...nextState.floatingTexts,
        { id: nextState.nextId, x: 6, y: 4, text: '全屏冰冻!', color: '#8aeaff', life: 1.2 },
      ],
      nextId: nextState.nextId + 1,
    }
  } else if (skill === 'gold') {
    nextState = {
      ...nextState,
      gold: nextState.gold + 120,
      floatingTexts: [
        ...nextState.floatingTexts,
        { id: nextState.nextId, x: 6, y: 4, text: '+120 金币', color: '#ffd54f', life: 1.2 },
      ],
      nextId: nextState.nextId + 1,
    }
  } else if (skill === 'bomb') {
    const damaged = nextState.enemies.map((e) => ({ ...e, hp: e.hp - 90 }))
    const survivors: Enemy[] = []
    let gold = nextState.gold
    let score = nextState.score
    let kills = nextState.kills
    let combo = nextState.combo
    const newEnemies: Enemy[] = []
    let idCounter = nextState.nextId

    for (const enemy of damaged) {
      if (enemy.hp > 0) {
        survivors.push(enemy)
      } else {
        const def = ENEMY_DEFINITIONS[enemy.kind]
        gold += def.reward
        score += def.score
        kills += 1
        combo += 1
        if (def.splitInto && def.splitCount) {
          for (let i = 0; i < def.splitCount; i++) {
            newEnemies.push(createEnemy(def.splitInto, idCounter++, enemy.progress - 0.1 + i * 0.08))
          }
        }
      }
    }

    nextState = {
      ...nextState,
      enemies: [...survivors, ...newEnemies],
      gold,
      score,
      kills,
      combo,
      comboTimer: 2.5,
      floatingTexts: [
        ...nextState.floatingTexts,
        { id: idCounter, x: 6, y: 4, text: '陨石轰炸!', color: '#ff7043', life: 1.2 },
      ],
      nextId: idCounter + 1,
    }
  }

  return nextState
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function finishWaveIfNeeded(state: GameState): GameState {
  if (state.phase !== 'wave' || state.spawnQueue.length > 0 || state.enemies.length > 0) {
    return state
  }
  if (state.wave >= WAVES.length) {
    const stars = state.lives >= INITIAL_LIVES * 0.8 ? 3 : state.lives >= INITIAL_LIVES * 0.5 ? 2 : 1
    return {
      ...state,
      phase: 'victory',
      score: state.score + state.lives * 100 + stars * 200,
    }
  }
  return {
    ...state,
    phase: 'ready',
    gold: state.gold + 50 + state.wave * 12,
    score: state.score + state.wave * 80,
  }
}

export function getStarRating(state: GameState): number {
  if (state.phase !== 'victory') return 0
  return state.lives >= INITIAL_LIVES * 0.8 ? 3 : state.lives >= INITIAL_LIVES * 0.5 ? 2 : 1
}

export function stepGame(state: GameState, deltaSeconds: number): GameState {
  if (state.phase !== 'wave') return state

  const delta = Math.max(0, Math.min(deltaSeconds, 60))
  let nextId = state.nextId
  const spawnQueue = [...state.spawnQueue]
  const enemies = state.enemies.map((enemy) => ({ ...enemy }))
  const towers = state.towers.map((tower) => ({ ...tower }))
  const obstacles = state.obstacles.map((o) => ({ ...o }))
  let spawnTimer = state.spawnTimer - delta

  while (spawnQueue.length > 0 && spawnTimer <= 0) {
    enemies.push(createEnemy(spawnQueue.shift()!, nextId))
    nextId += 1
    spawnTimer += 0.75
  }

  let lives = state.lives
  const activeEnemies: Enemy[] = []
  for (const enemy of enemies) {
    const definition = ENEMY_DEFINITIONS[enemy.kind]
    const stunned = enemy.stunTimer > 0
    const slowed = enemy.slowTimer > 0

    if (!stunned) {
      enemy.progress += definition.speed * (slowed ? enemy.speedMultiplier : 1) * delta
    }
    enemy.slowTimer = Math.max(0, enemy.slowTimer - delta)
    enemy.stunTimer = Math.max(0, enemy.stunTimer - delta)

    if (enemy.burnTimer > 0) {
      enemy.hp -= enemy.burnDps * delta
      enemy.burnTimer = Math.max(0, enemy.burnTimer - delta)
    }

    if (enemy.progress >= PATH_POINTS.length - 1) {
      lives = Math.max(0, lives - definition.leakDamage)
    } else if (enemy.hp > 0) {
      activeEnemies.push(enemy)
    }
  }

  const skillCooldowns: Record<SkillKind, number> = {
    freeze: Math.max(0, state.skillCooldowns.freeze - delta),
    gold: Math.max(0, state.skillCooldowns.gold - delta),
    bomb: Math.max(0, state.skillCooldowns.bomb - delta),
  }

  let comboTimer = Math.max(0, state.comboTimer - delta)
  let combo = comboTimer > 0 ? state.combo : 0

  const floatingTexts = state.floatingTexts
    .map((ft) => ({ ...ft, life: ft.life - delta, y: ft.y - delta * 0.5 }))
    .filter((ft) => ft.life > 0)

  const baseState: GameState = {
    ...state,
    lives,
    elapsed: state.elapsed + delta,
    towers,
    enemies: activeEnemies,
    obstacles,
    shots: state.shots
      .map((shot) => ({ ...shot, life: shot.life - delta }))
      .filter((shot) => shot.life > 0),
    floatingTexts,
    spawnQueue,
    spawnTimer,
    nextId,
    skillCooldowns,
    combo,
    comboTimer,
  }

  if (lives <= 0) {
    return { ...baseState, phase: 'defeat' }
  }

  for (const tower of towers) {
    tower.cooldown -= delta
    if (tower.cooldown > 0) continue

    const stats = getTowerStats(tower)
    const towerPosition = { x: tower.column + 0.5, y: tower.row + 0.5 }

    const validEnemies = activeEnemies.filter((enemy) => {
      if (enemy.hp <= 0) return false
      const def = ENEMY_DEFINITIONS[enemy.kind]
      if (def.isFlying && !stats.canHitAir) return false
      if (!def.isFlying && !stats.canHitGround) return false
      return distance(towerPosition, getEnemyPosition(enemy)) <= stats.range
    })

    const target = validEnemies.sort((left, right) => right.progress - left.progress)[0]

    if (!target) {
      const nearbyObstacle = obstacles.find(
        (o) =>
          o.hp > 0 &&
          distance(towerPosition, { x: o.column + 0.5, y: o.row + 0.5 }) <= stats.range,
      )
      if (nearbyObstacle) {
        nearbyObstacle.hp -= stats.damage * 0.6
        tower.cooldown = stats.fireInterval
        baseState.shots.push({
          id: baseState.nextId,
          fromX: towerPosition.x,
          fromY: towerPosition.y,
          targetX: nearbyObstacle.column + 0.5,
          targetY: nearbyObstacle.row + 0.5,
          kind: tower.kind,
          life: 0.12,
          maxLife: 0.12,
        })
        baseState.nextId += 1
        if (nearbyObstacle.hp <= 0) {
          baseState.gold += nearbyObstacle.reward
          baseState.floatingTexts.push({
            id: baseState.nextId,
            x: nearbyObstacle.column + 0.5,
            y: nearbyObstacle.row + 0.5,
            text: `+${nearbyObstacle.reward}`,
            color: '#ffd54f',
            life: 1,
          })
          baseState.nextId += 1
        }
      } else {
        tower.cooldown = 0
      }
      continue
    }

    const targetPosition = getEnemyPosition(target)
    const victims: Enemy[] = []

    if (stats.splash) {
      for (const enemy of activeEnemies) {
        if (enemy.hp <= 0) continue
        const def = ENEMY_DEFINITIONS[enemy.kind]
        if (def.isFlying && !stats.canHitAir) continue
        if (!def.isFlying && !stats.canHitGround) continue
        if (distance(getEnemyPosition(enemy), targetPosition) <= stats.splash) {
          victims.push(enemy)
        }
      }
    } else {
      victims.push(target)
    }

    victims.forEach((enemy) => {
      enemy.hp -= stats.damage
      if (stats.slowMultiplier && stats.slowDuration) {
        enemy.slowTimer = Math.max(enemy.slowTimer, stats.slowDuration)
        enemy.speedMultiplier = Math.min(enemy.speedMultiplier, stats.slowMultiplier)
      }
      if (stats.burnDamage && stats.burnDuration) {
        enemy.burnTimer = Math.max(enemy.burnTimer, stats.burnDuration)
        enemy.burnDps = Math.max(enemy.burnDps, stats.burnDamage)
      }
      if (stats.stunDuration) {
        enemy.stunTimer = Math.max(enemy.stunTimer, stats.stunDuration)
      }
    })

    if (stats.chainCount && stats.chainRange) {
      const chainCount = stats.chainCount
      const chainRange = stats.chainRange
      const hitIds = new Set(victims.map((v) => v.id))
      let currentPos = targetPosition
      let chainDamage = stats.damage * 0.7
      for (let i = 0; i < chainCount; i++) {
        const nextTarget = activeEnemies
          .filter((e) => {
            if (e.hp <= 0 || hitIds.has(e.id)) return false
            const def = ENEMY_DEFINITIONS[e.kind]
            if (def.isFlying && !stats.canHitAir) return false
            if (!def.isFlying && !stats.canHitGround) return false
            return distance(getEnemyPosition(e), currentPos) <= chainRange
          })
          .sort((a, b) => b.progress - a.progress)[0]
        if (!nextTarget) break
        nextTarget.hp -= chainDamage
        hitIds.add(nextTarget.id)
        const nextPos = getEnemyPosition(nextTarget)
        baseState.shots.push({
          id: baseState.nextId,
          fromX: currentPos.x,
          fromY: currentPos.y,
          targetX: nextPos.x,
          targetY: nextPos.y,
          kind: tower.kind,
          life: 0.12,
          maxLife: 0.12,
          isChain: true,
        })
        baseState.nextId += 1
        currentPos = nextPos
        chainDamage *= 0.75
      }
    }

    tower.cooldown = stats.fireInterval
    baseState.shots.push({
      id: baseState.nextId,
      fromX: towerPosition.x,
      fromY: towerPosition.y,
      targetX: targetPosition.x,
      targetY: targetPosition.y,
      kind: tower.kind,
      life: 0.14,
      maxLife: 0.14,
    })
    baseState.nextId += 1
  }

  let gold = baseState.gold
  let score = baseState.score
  let kills = baseState.kills
  let newKillScore = 0
  const survivors: Enemy[] = []
  const newlySpawned: Enemy[] = []

  for (const enemy of activeEnemies) {
    if (enemy.hp > 0) {
      survivors.push(enemy)
    } else {
      const definition = ENEMY_DEFINITIONS[enemy.kind]
      gold += definition.reward
      newKillScore += definition.score
      kills += 1
      combo += 1
      comboTimer = 2.5
      const pos = getEnemyPosition(enemy)
      baseState.floatingTexts.push({
        id: baseState.nextId,
        x: pos.x,
        y: pos.y,
        text: `+${definition.reward}`,
        color: '#ffd54f',
        life: 0.8,
      })
      baseState.nextId += 1

      if (definition.splitInto && definition.splitCount) {
        for (let i = 0; i < definition.splitCount; i++) {
          newlySpawned.push(
            createEnemy(definition.splitInto, baseState.nextId++, enemy.progress - 0.1 + i * 0.08),
          )
        }
      }
    }
  }

  const comboMultiplier = 1 + Math.min(combo, 20) * 0.02
  const finalScore = score + Math.round(newKillScore * comboMultiplier)

  return finishWaveIfNeeded({
    ...baseState,
    gold,
    score: finalScore,
    kills,
    combo,
    comboTimer,
    enemies: [...survivors, ...newlySpawned],
    towers,
    obstacles: obstacles.filter((o) => o.hp > 0),
  })
}
